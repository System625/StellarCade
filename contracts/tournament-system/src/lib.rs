//! StellarCade Tournament System Contract
//!
//! Manages the lifecycle of gaming tournaments, including creation, player
//! registration, result recording, and finalization.
//!
//! ## Storage Strategy
//! - `instance()`: Admin, FeeContract, RewardContract. Shared config.
//! - `persistent()`: TournamentData, PlayerRegistration, Scores.
//!   Each tournament and registration is a separate ledger entry.

#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    Address, BytesN, Env,
};

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized      = 1,
    NotInitialized          = 2,
    NotAuthorized           = 3,
    InvalidAmount           = 4,
    TournamentNotFound      = 5,
    TournamentAlreadyExists = 6,
    TournamentNotActive     = 7,
    TournamentAlreadyFinalized = 8,
    PlayerAlreadyJoined     = 9,
    PlayerNotJoined         = 10,
    InvalidStateTransition  = 11,
    Overflow                = 12,
}

// ---------------------------------------------------------------------------
// Storage Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TournamentStatus {
    Active      = 0, // Accepting joins and results
    Finalized   = 1, // Closed, no more changes
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TournamentData {
    pub rules_hash: BytesN<32>,
    pub entry_fee: i128,
    pub status: TournamentStatus,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeContract,
    RewardContract,
    Tournament(u64),
    PlayerJoined(u64, Address),
    PlayerScore(u64, Address),
}

const PERSISTENT_BUMP_LEDGERS: u32 = 518_400; // ~30 days

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct TournamentCreated {
    #[topic]
    pub id: u64,
    pub rules_hash: BytesN<32>,
    pub entry_fee: i128,
}

#[contractevent]
pub struct PlayerJoined {
    #[topic]
    pub id: u64,
    #[topic]
    pub player: Address,
    pub fee_paid: i128,
}

#[contractevent]
pub struct ResultRecorded {
    #[topic]
    pub id: u64,
    #[topic]
    pub player: Address,
    pub score: u64,
}

#[contractevent]
pub struct TournamentFinalized {
    #[topic]
    pub id: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct TournamentSystem;

#[contractimpl]
impl TournamentSystem {
    /// Initialize the tournament system. May only be called once.
    pub fn init(
        env: Env,
        admin: Address,
        fee_contract: Address,
        reward_contract: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeContract, &fee_contract);
        env.storage().instance().set(&DataKey::RewardContract, &reward_contract);

        Ok(())
    }

    /// Create a new tournament. Admin only.
    pub fn create_tournament(
        env: Env,
        admin: Address,
        id: u64,
        rules_hash: BytesN<32>,
        entry_fee: i128,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        if entry_fee < 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Tournament(id);
        if env.storage().persistent().has(&key) {
            return Err(Error::TournamentAlreadyExists);
        }

        let data = TournamentData {
            rules_hash: rules_hash.clone(),
            entry_fee,
            status: TournamentStatus::Active,
        };

        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        TournamentCreated { id, rules_hash, entry_fee }.publish(&env);

        Ok(())
    }

    /// Join an active tournament. Player pays entry fee.
    pub fn join_tournament(env: Env, player: Address, id: u64) -> Result<(), Error> {
        let key = DataKey::Tournament(id);
        let tournament: TournamentData = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::TournamentNotFound)?;

        if tournament.status != TournamentStatus::Active {
            return Err(Error::TournamentNotActive);
        }

        let join_key = DataKey::PlayerJoined(id, player.clone());
        if env.storage().persistent().has(&join_key) {
            return Err(Error::PlayerAlreadyJoined);
        }

        player.require_auth();

        // In this architecture, we emit the event and the fee_paid amount.
        // Off-chain or a separate contract handles the actual transfer if 
        // the fee_contract is just a reference. 
        // However, if we wanted to be atomic, we'd call fee_contract here.
        // Given the AchievementBadge pattern, we stick to Event-Driven.

        env.storage().persistent().set(&join_key, &true);
        env.storage().persistent().extend_ttl(&join_key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        PlayerJoined {
            id,
            player,
            fee_paid: tournament.entry_fee,
        }
        .publish(&env);

        Ok(())
    }

    /// Record a score for a player in a tournament. Admin/Authorized only.
    pub fn record_result(
        env: Env,
        admin: Address,
        id: u64,
        player: Address,
        score: u64,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        let key = DataKey::Tournament(id);
        let tournament: TournamentData = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::TournamentNotFound)?;

        if tournament.status != TournamentStatus::Active {
            return Err(Error::TournamentNotActive);
        }

        // Check if player actually joined
        let join_key = DataKey::PlayerJoined(id, player.clone());
        if !env.storage().persistent().has(&join_key) {
            return Err(Error::PlayerNotJoined);
        }

        let score_key = DataKey::PlayerScore(id, player.clone());
        env.storage().persistent().set(&score_key, &score);
        env.storage().persistent().extend_ttl(&score_key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        ResultRecorded { id, player, score }.publish(&env);

        Ok(())
    }

    /// Finalize a tournament. Admin only. 
    /// Prevents further joins or result recording. 
    pub fn finalize_tournament(env: Env, admin: Address, id: u64) -> Result<(), Error> {
        require_admin(&env, &admin)?;

        let key = DataKey::Tournament(id);
        let mut tournament: TournamentData = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::TournamentNotFound)?;

        if tournament.status == TournamentStatus::Finalized {
            return Err(Error::TournamentAlreadyFinalized);
        }

        tournament.status = TournamentStatus::Finalized;
        env.storage().persistent().set(&key, &tournament);
        env.storage().persistent().extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);

        TournamentFinalized { id }.publish(&env);

        Ok(())
    }

    // --- Getters ---

    pub fn get_tournament(env: Env, id: u64) -> Option<TournamentData> {
        env.storage().persistent().get(&DataKey::Tournament(id))
    }

    pub fn get_score(env: Env, id: u64, player: Address) -> Option<u64> {
        env.storage().persistent().get(&DataKey::PlayerScore(id, player))
    }

    pub fn is_joined(env: Env, id: u64, player: Address) -> bool {
        env.storage().persistent().has(&DataKey::PlayerJoined(id, player))
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    caller.require_auth();
    if caller != &admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, BytesN};

    fn setup(env: &Env) -> (TournamentSystemClient, Address, Address, Address) {
        let admin = Address::generate(env);
        let fee_contract = Address::generate(env);
        let reward_contract = Address::generate(env);

        let contract_id = env.register(TournamentSystem, ());
        let client = TournamentSystemClient::new(env, &contract_id);

        client.init(&admin, &fee_contract, &reward_contract);

        (client, admin, fee_contract, reward_contract)
    }

    #[test]
    fn test_init_and_create() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 101u64;
        let rules_hash = BytesN::from_array(&env, &[0u8; 32]);
        let entry_fee = 100i128;

        env.mock_all_auths();
        client.create_tournament(&admin, &id, &rules_hash, &entry_fee);

        let t = client.get_tournament(&id).unwrap();
        assert_eq!(t.entry_fee, 100);
        assert_eq!(t.status, TournamentStatus::Active);
    }

    #[test]
    fn test_join_tournament() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 1u64;
        let rules_hash = BytesN::from_array(&env, &[0u8; 32]);
        let entry_fee = 50i128;

        env.mock_all_auths();
        client.create_tournament(&admin, &id, &rules_hash, &entry_fee);

        let player = Address::generate(&env);
        client.join_tournament(&player, &id);

        assert!(client.is_joined(&id, &player));
    }

    #[test]
    fn test_join_twice_fails() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 1u64;
        env.mock_all_auths();
        client.create_tournament(&admin, &id, &BytesN::from_array(&env, &[0u8; 32]), &0i128);

        let player = Address::generate(&env);
        client.join_tournament(&player, &id);
        
        let result = client.try_join_tournament(&player, &id);
        assert_eq!(result, Err(Ok(Error::PlayerAlreadyJoined)));
    }

    #[test]
    fn test_record_and_finalize() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 1u64;
        env.mock_all_auths();
        client.create_tournament(&admin, &id, &BytesN::from_array(&env, &[0u8; 32]), &0i128);

        let player = Address::generate(&env);
        client.join_tournament(&player, &id);

        client.record_result(&admin, &id, &player, &9500u64);
        assert_eq!(client.get_score(&id, &player), Some(9500));

        client.finalize_tournament(&admin, &id);
        let t = client.get_tournament(&id).unwrap();
        assert_eq!(t.status, TournamentStatus::Finalized);
    }

    #[test]
    fn test_cannot_join_finalized() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 1u64;
        env.mock_all_auths();
        client.create_tournament(&admin, &id, &BytesN::from_array(&env, &[0u8; 32]), &0i128);
        client.finalize_tournament(&admin, &id);

        let player = Address::generate(&env);
        let result = client.try_join_tournament(&player, &id);
        assert_eq!(result, Err(Ok(Error::TournamentNotActive)));
    }

    #[test]
    fn test_record_result_unjoined_fails() {
        let env = Env::default();
        let (client, admin, _, _) = setup(&env);

        let id = 1u64;
        env.mock_all_auths();
        client.create_tournament(&admin, &id, &BytesN::from_array(&env, &[0u8; 32]), &0i128);

        let player = Address::generate(&env);
        let result = client.try_record_result(&admin, &id, &player, &100u64);
        assert_eq!(result, Err(Ok(Error::PlayerNotJoined)));
    }

    #[test]
    fn test_unauthorized_create_fails() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);

        let attacker = Address::generate(&env);
        env.mock_all_auths();
        let result = client.try_create_tournament(&attacker, &1u64, &BytesN::from_array(&env, &[0u8; 32]), &0i128);
        assert_eq!(result, Err(Ok(Error::NotAuthorized)));
    }
}
