#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address,
    BytesN, Env, Symbol,
};

// ---------------------------------------------------------------------------
// TTL / storage constants
// ---------------------------------------------------------------------------

const PERSISTENT_BUMP_LEDGERS: u32 = 518_400; // ~30 days
const PERSISTENT_BUMP_THRESHOLD: u32 = PERSISTENT_BUMP_LEDGERS - 100_800; // Renew ~7 days early

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InvalidEpochDuration = 4,
    InvalidScheduleEpoch = 5,
    TaskAlreadyExecuted = 6,
    TaskNotFound = 7,
    EpochNotReached = 8,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TaskData {
    pub epoch: u64,
    pub payload_hash: BytesN<32>,
    pub executed: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    EpochDuration,
    Task(Symbol), // Keyed by task_id
}

// ---------------------------------------------------------------------------
// Epoch snapshot
// ---------------------------------------------------------------------------

/// Read-only timing snapshot returned by `epoch_snapshot`.
///
/// All ledger values are expressed in ledger-sequence units.
/// Returns `None` from `epoch_snapshot` when the contract is not yet
/// initialised.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EpochSnapshot {
    /// The epoch that is active at the current ledger sequence.
    pub current_epoch: u64,
    /// Number of ledgers per epoch as configured at init time.
    pub epoch_duration: u32,
    /// The ledger sequence at which the current epoch started (last rollover).
    pub current_epoch_start_ledger: u64,
    /// The ledger sequence at which the next epoch will begin.
    pub next_epoch_start_ledger: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct ContractInitialized {
    pub admin: Address,
    pub epoch_duration: u32,
}

#[contractevent]
pub struct TaskScheduled {
    pub task_id: Symbol,
    pub epoch: u64,
}

#[contractevent]
pub struct TaskExecuted {
    pub task_id: Symbol,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct EpochScheduler;

#[contractimpl]
impl EpochScheduler {
    /// Initialise the epoch scheduler contract.
    pub fn init(env: Env, admin: Address, epoch_duration: u32) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        if epoch_duration == 0 {
            return Err(Error::InvalidEpochDuration);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EpochDuration, &epoch_duration);

        ContractInitialized { admin, epoch_duration }.publish(&env);

        Ok(())
    }

    /// View the current epoch based on ledger sequence.
    pub fn current_epoch(env: Env) -> u64 {
        let duration: u32 = env.storage().instance().get(&DataKey::EpochDuration).unwrap_or(0);
        if duration == 0 {
            return 0;
        }
        (env.ledger().sequence() as u64) / (duration as u64)
    }

    /// Schedule a task for a future or current epoch.
    pub fn schedule_task(
        env: Env,
        task_id: Symbol,
        epoch: u64,
        payload_hash: BytesN<32>,
    ) -> Result<(), Error> {
        // Any user can schedule a task in this base version, or it could be restricted.
        // Assuming open scheduling for now.

        let current = Self::current_epoch(env.clone());
        if epoch < current {
            return Err(Error::InvalidScheduleEpoch);
        }

        let key = DataKey::Task(task_id.clone());
        
        // Prevent overwriting if we wanted to enforce unique task_ids across all time
        // or just allow updating before execution. Let's allow update if not executed.
        if let Some(existing) = env.storage().persistent().get::<_, TaskData>(&key) {
            if existing.executed {
                return Err(Error::TaskAlreadyExecuted);
            }
        }

        let data = TaskData {
            epoch,
            payload_hash,
            executed: false,
        };

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_BUMP_LEDGERS,
        );

        TaskScheduled { task_id, epoch }.publish(&env);

        Ok(())
    }

    /// Mark a task as executed. Restricted to Admin.
    pub fn mark_executed(env: Env, task_id: Symbol) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let current = Self::current_epoch(env.clone());
        let key = DataKey::Task(task_id.clone());
        
        let mut task: TaskData = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::TaskNotFound)?;

        if task.executed {
            return Err(Error::TaskAlreadyExecuted);
        }

        if current < task.epoch {
            return Err(Error::EpochNotReached);
        }

        task.executed = true;
        env.storage().persistent().set(&key, &task);

        TaskExecuted { task_id }.publish(&env);

        Ok(())
    }

    /// Query the state of a task.
    pub fn task_state(env: Env, task_id: Symbol) -> Option<TaskData> {
        env.storage().persistent().get(&DataKey::Task(task_id))
    }

    /// Returns a timing snapshot combining the current epoch, the next epoch
    /// boundary, and the ledger at which the current epoch began (last
    /// rollover).
    ///
    /// Returns `None` when the contract has not yet been initialised or the
    /// epoch duration is zero, making the uninitialized state explicit.
    pub fn epoch_snapshot(env: Env) -> Option<EpochSnapshot> {
        let duration: u32 = env.storage().instance().get(&DataKey::EpochDuration)?;
        if duration == 0 {
            return None;
        }
        let sequence = env.ledger().sequence() as u64;
        let duration_u64 = duration as u64;
        let current_epoch = sequence / duration_u64;
        let current_epoch_start_ledger = current_epoch * duration_u64;
        let next_epoch_start_ledger = current_epoch_start_ledger.saturating_add(duration_u64);

        Some(EpochSnapshot {
            current_epoch,
            epoch_duration: duration,
            current_epoch_start_ledger,
            next_epoch_start_ledger,
        })
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn require_admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, BytesN, symbol_short};

    struct Setup<'a> {
        env: Env,
        client: EpochSchedulerClient<'a>,
        _admin: Address,
    }

    fn setup() -> Setup<'static> {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(EpochScheduler, ());
        let client = EpochSchedulerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.init(&admin, &100); // 100 ledgers per epoch

        let client: EpochSchedulerClient<'static> = unsafe { core::mem::transmute(client) };

        Setup {
            env,
            client,
            _admin: admin,
        }
    }

    #[test]
    fn test_current_epoch() {
        let s = setup();
        
        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 50,
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        assert_eq!(s.client.current_epoch(), 0);

        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 150,
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        assert_eq!(s.client.current_epoch(), 1);

        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 1000,
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        assert_eq!(s.client.current_epoch(), 10);
    }

    #[test]
    fn test_scheduling_and_execution() {
        let s = setup();
        let task_id = symbol_short!("task1");
        let hash = BytesN::from_array(&s.env, &[0u8; 32]);

        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 50, // Epoch 0
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        
        // Schedule for epoch 2
        s.client.schedule_task(&task_id, &2, &hash);
        
        let state = s.client.task_state(&task_id).unwrap();
        assert_eq!(state.epoch, 2);
        assert_eq!(state.executed, false);

        // Attempt to execute in epoch 1 - should fail
        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 150, // Epoch 1
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        let result = s.client.try_mark_executed(&task_id);
        assert_eq!(result, Err(Ok(Error::EpochNotReached)));

        // Execute in epoch 2 - should succeed
        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 250, // Epoch 2
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        s.client.mark_executed(&task_id);

        let state = s.client.task_state(&task_id).unwrap();
        assert_eq!(state.executed, true);
    }

    #[test]
    fn test_invalid_schedule_epoch() {
        let s = setup();
        let task_id = symbol_short!("task1");
        let hash = BytesN::from_array(&s.env, &[0u8; 32]);

        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 550, // Epoch 5
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });

        // Attempt to schedule for epoch 4 - should fail
        let result = s.client.try_schedule_task(&task_id, &4, &hash);
        assert_eq!(result, Err(Ok(Error::InvalidScheduleEpoch)));
    }

    // ── epoch_snapshot ────────────────────────────────────────────────────────

    #[test]
    fn test_epoch_snapshot_uninitialized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(EpochScheduler, ());
        let client = EpochSchedulerClient::new(&env, &contract_id);
        // Contract not yet initialised — snapshot must be None
        assert!(client.epoch_snapshot().is_none());
    }

    #[test]
    fn test_epoch_snapshot_active_state() {
        let s = setup(); // epoch_duration = 100

        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 250, // Epoch 2 (250 / 100 = 2)
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });

        let snap = s.client.epoch_snapshot().unwrap();
        assert_eq!(snap.current_epoch, 2);
        assert_eq!(snap.epoch_duration, 100);
        assert_eq!(snap.current_epoch_start_ledger, 200); // 2 * 100
        assert_eq!(snap.next_epoch_start_ledger, 300);    // 3 * 100
    }

    #[test]
    fn test_epoch_snapshot_last_rollover_after_transition() {
        let s = setup(); // epoch_duration = 100

        // Before rollover: sequence 199 → epoch 1
        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 199,
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        let snap_before = s.client.epoch_snapshot().unwrap();
        assert_eq!(snap_before.current_epoch, 1);
        assert_eq!(snap_before.current_epoch_start_ledger, 100);
        assert_eq!(snap_before.next_epoch_start_ledger, 200);

        // After rollover: sequence 200 → epoch 2
        s.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 0,
            protocol_version: 25,
            sequence_number: 200,
            network_id: [0u8; 32],
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 1000000,
        });
        let snap_after = s.client.epoch_snapshot().unwrap();
        assert_eq!(snap_after.current_epoch, 2);
        assert_eq!(snap_after.current_epoch_start_ledger, 200);
        assert_eq!(snap_after.next_epoch_start_ledger, 300);
    }
}
