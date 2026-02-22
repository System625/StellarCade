//! Stellarcade Wordle Clone Contract
//!
//! A daily on-chain Wordle game where players submit up to 6 guesses for a
//! hidden 5-letter word. Each guess is scored against the answer after the
//! puzzle is finalized by the admin using commit-reveal.
//!
//! ## Game Flow
//! 1. Admin calls `create_daily_puzzle` with SHA-256(answer) as `answer_commitment`.
//! 2. Players call `submit_attempt` with their 5-letter guess (up to 6 times).
//! 3. Admin calls `reveal_answer` with the plaintext answer (verifies commitment).
//! 4. Admin calls `finalize_result(player, puzzle_id)` per the issue interface;
//!    all player attempts are scored and winners recorded.
//! 5. Players call `get_attempts` to read their scored attempt history.
//!
//! ## Guess Scoring
//! Each character in a guess is scored per position:
//! - `2` (CORRECT)  — right letter, right position.
//! - `1` (PRESENT)  — right letter, wrong position.
//! - `0` (ABSENT)   — letter not in the answer at all.
//!
//! Scoring mirrors the standard Wordle algorithm: exact matches are resolved
//! first, then remaining answer characters are consumed for PRESENT matches,
//! so each answer character accounts for at most one PRESENT mark.
//!
//! ## Storage Strategy
//! - `instance()` storage: contract-level config (Admin, PrizePoolContract,
//!   BalanceContract). Small, bounded, stored in a single ledger entry.
//! - `persistent()` storage: per-puzzle and per-player data (Puzzle, AttemptList,
//!   Winner). Each key is an independent ledger entry with its own TTL extended
//!   on every write (~30 days).
//!
//! ## Security
//! - Only the admin may create puzzles, reveal answers, or finalize results.
//! - Players may submit at most `MAX_ATTEMPTS` (6) guesses per puzzle.
//! - Guesses must be exactly `WORD_LENGTH` (5) bytes.
//! - Finalization verifies the commitment before scoring, preventing answer
//!   manipulation after guesses are locked in.
//! - All arithmetic uses `checked_*` to prevent overflow.
#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Bytes, BytesN,
    Env, Vec,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Number of characters in every guess/answer (standard Wordle word length).
pub const WORD_LENGTH: u32 = 5;

/// Maximum guesses a player may submit per puzzle.
pub const MAX_ATTEMPTS: u32 = 6;

/// Maximum players allowed per puzzle (bounds O(n) iteration in finalize_result).
pub const MAX_PLAYERS_PER_PUZZLE: u32 = 1_000;

/// Persistent storage TTL (~30 days at 5 s/ledger).
pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    PuzzleAlreadyExists = 4,
    PuzzleNotFound = 5,
    PuzzleNotOpen = 6,
    PuzzleAlreadyFinalized = 7,
    TooManyAttempts = 8,
    InvalidWordLength = 9,
    CommitmentMismatch = 10,
    Overflow = 11,
    PuzzleFull = 12,
    AnswerNotRevealed = 13,
}

// ---------------------------------------------------------------------------
// Score constants
// ---------------------------------------------------------------------------

/// Letter is absent from the answer.
pub const SCORE_ABSENT: u32 = 0;
/// Letter is in the answer but in the wrong position.
pub const SCORE_PRESENT: u32 = 1;
/// Letter is in the correct position.
pub const SCORE_CORRECT: u32 = 2;

// ---------------------------------------------------------------------------
// Storage types
// ---------------------------------------------------------------------------

/// Lifecycle state of a puzzle.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PuzzleStatus {
    /// Accepting player guesses.
    Open = 0,
    /// Admin has revealed the answer; waiting for finalization.
    Revealed = 1,
    /// All attempts scored; puzzle complete.
    Finalized = 2,
}

/// Puzzle metadata and result summary.
#[contracttype]
#[derive(Clone)]
pub struct PuzzleData {
    /// SHA-256(plaintext_answer) committed at creation time.
    pub answer_commitment: BytesN<32>,
    pub status: PuzzleStatus,
    /// Plaintext answer — empty until `reveal_answer` is called.
    pub answer: Bytes,
    /// Number of players who solved the puzzle.
    pub winner_count: u32,
    /// Number of distinct players who submitted at least one attempt.
    pub player_count: u32,
}

/// A single scored guess.
#[contracttype]
#[derive(Clone)]
pub struct Attempt {
    /// The 5-letter guess submitted by the player.
    pub guess: Bytes,
    /// Per-character scores: Vec of SCORE_* constants, length == WORD_LENGTH.
    /// Empty until the puzzle is finalized.
    pub scores: Vec<u32>,
}

/// Storage key discriminants.
///
/// Instance keys (Admin, PrizePoolContract, BalanceContract) live in a single
/// ledger entry and hold small, fixed-size contract config.
///
/// Persistent keys (Puzzle, PlayerList, Attempts, Winner) are per-puzzle and
/// per-player, each stored as an independent ledger entry with its own TTL.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // --- instance() keys ---
    Admin,
    PrizePoolContract,
    BalanceContract,
    // --- persistent() keys ---
    /// PuzzleData keyed by puzzle_id.
    Puzzle(u64),
    /// Vec<Address> of all players who submitted at least one attempt.
    PlayerList(u64),
    /// Vec<Attempt> for a (puzzle_id, player) pair.
    Attempts(u64, Address),
    /// Set to `true` when a player solves the puzzle.
    Winner(u64, Address),
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct PuzzleCreated {
    #[topic]
    pub puzzle_id: u64,
    pub answer_commitment: BytesN<32>,
}

#[contractevent]
pub struct AttemptSubmitted {
    #[topic]
    pub puzzle_id: u64,
    #[topic]
    pub player: Address,
    /// Attempt number (1-indexed).
    pub attempt_number: u32,
    pub guess: Bytes,
}

#[contractevent]
pub struct AnswerRevealed {
    #[topic]
    pub puzzle_id: u64,
}

#[contractevent]
pub struct PuzzleFinalized {
    #[topic]
    pub puzzle_id: u64,
    pub answer: Bytes,
    pub winner_count: u32,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct WordleClone;

#[contractimpl]
impl WordleClone {
    // -----------------------------------------------------------------------
    // init
    // -----------------------------------------------------------------------

    /// Initialize the contract. May only be called once.
    ///
    /// Stores admin, prize pool contract address, and balance contract address
    /// in instance storage. Subsequent calls return `AlreadyInitialized`.
    pub fn init(
        env: Env,
        admin: Address,
        prize_pool_contract: Address,
        balance_contract: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PrizePoolContract, &prize_pool_contract);
        env.storage()
            .instance()
            .set(&DataKey::BalanceContract, &balance_contract);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // create_daily_puzzle
    // -----------------------------------------------------------------------

    /// Create a new daily puzzle. Admin only.
    ///
    /// `puzzle_id` must be unique. `answer_commitment` is `SHA-256(answer_bytes)`
    /// computed off-chain. The plaintext answer is never stored until the admin
    /// calls `reveal_answer`.
    ///
    /// Emits `PuzzleCreated`.
    pub fn create_daily_puzzle(
        env: Env,
        puzzle_id: u64,
        answer_commitment: BytesN<32>,
    ) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if env.storage().persistent().has(&DataKey::Puzzle(puzzle_id)) {
            return Err(Error::PuzzleAlreadyExists);
        }

        let puzzle = PuzzleData {
            answer_commitment: answer_commitment.clone(),
            status: PuzzleStatus::Open,
            answer: Bytes::new(&env),
            winner_count: 0,
            player_count: 0,
        };

        persist_set(&env, DataKey::Puzzle(puzzle_id), &puzzle);
        persist_set(
            &env,
            DataKey::PlayerList(puzzle_id),
            &Vec::<Address>::new(&env),
        );

        PuzzleCreated {
            puzzle_id,
            answer_commitment,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // submit_attempt
    // -----------------------------------------------------------------------

    /// Submit a 5-letter guess for an open puzzle.
    ///
    /// A player may submit up to `MAX_ATTEMPTS` (6) guesses. Guesses must be
    /// exactly `WORD_LENGTH` (5) bytes. Scores are computed after finalization;
    /// the `scores` field is empty until then.
    ///
    /// Emits `AttemptSubmitted`.
    pub fn submit_attempt(
        env: Env,
        player: Address,
        puzzle_id: u64,
        attempt: Bytes,
    ) -> Result<(), Error> {
        player.require_auth();

        if attempt.len() != WORD_LENGTH {
            return Err(Error::InvalidWordLength);
        }

        let mut puzzle: PuzzleData = env
            .storage()
            .persistent()
            .get(&DataKey::Puzzle(puzzle_id))
            .ok_or(Error::PuzzleNotFound)?;

        if puzzle.status != PuzzleStatus::Open {
            return Err(Error::PuzzleNotOpen);
        }

        let mut attempts: Vec<Attempt> = env
            .storage()
            .persistent()
            .get(&DataKey::Attempts(puzzle_id, player.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        let attempt_number = attempts.len();
        if attempt_number >= MAX_ATTEMPTS {
            return Err(Error::TooManyAttempts);
        }

        // Register new player in PlayerList on their first attempt.
        if attempt_number == 0 {
            if puzzle.player_count >= MAX_PLAYERS_PER_PUZZLE {
                return Err(Error::PuzzleFull);
            }
            let mut players: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::PlayerList(puzzle_id))
                .unwrap_or_else(|| Vec::new(&env));
            players.push_back(player.clone());
            persist_set(&env, DataKey::PlayerList(puzzle_id), &players);

            puzzle.player_count = puzzle.player_count.checked_add(1).ok_or(Error::Overflow)?;
            persist_set(&env, DataKey::Puzzle(puzzle_id), &puzzle);
        }

        attempts.push_back(Attempt {
            guess: attempt.clone(),
            scores: Vec::new(&env),
        });
        persist_set(
            &env,
            DataKey::Attempts(puzzle_id, player.clone()),
            &attempts,
        );

        AttemptSubmitted {
            puzzle_id,
            player,
            attempt_number: attempt_number.checked_add(1).ok_or(Error::Overflow)?,
            guess: attempt,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // reveal_answer  (admin prerequisite before finalize_result)
    // -----------------------------------------------------------------------

    /// Reveal the plaintext answer for an open puzzle. Admin only.
    ///
    /// Verifies `SHA-256(answer) == answer_commitment`. Transitions the puzzle
    /// to `Revealed` state; no new player guesses are accepted after this call.
    /// Must be called before `finalize_result`.
    pub fn reveal_answer(env: Env, puzzle_id: u64, answer: Bytes) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if answer.len() != WORD_LENGTH {
            return Err(Error::InvalidWordLength);
        }

        let mut puzzle: PuzzleData = env
            .storage()
            .persistent()
            .get(&DataKey::Puzzle(puzzle_id))
            .ok_or(Error::PuzzleNotFound)?;

        if puzzle.status != PuzzleStatus::Open {
            return Err(Error::PuzzleAlreadyFinalized);
        }

        let revealed_hash: BytesN<32> = env.crypto().sha256(&answer).into();
        if revealed_hash != puzzle.answer_commitment {
            return Err(Error::CommitmentMismatch);
        }

        puzzle.status = PuzzleStatus::Revealed;
        puzzle.answer = answer;
        persist_set(&env, DataKey::Puzzle(puzzle_id), &puzzle);

        AnswerRevealed { puzzle_id }.publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // finalize_result
    // -----------------------------------------------------------------------

    /// Score all player attempts and record winners. Admin only.
    ///
    /// The `player` parameter is included per the issue interface; the contract
    /// scores ALL players in a single pass for consistency, then transitions
    /// the puzzle to `Finalized`. Must be called after `reveal_answer`.
    ///
    /// Iterates all submissions (bounded by `MAX_PLAYERS_PER_PUZZLE × MAX_ATTEMPTS`).
    /// A player is a winner if any of their attempts matches the answer exactly.
    ///
    /// Emits `PuzzleFinalized`.
    pub fn finalize_result(env: Env, player: Address, puzzle_id: u64) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let mut puzzle: PuzzleData = env
            .storage()
            .persistent()
            .get(&DataKey::Puzzle(puzzle_id))
            .ok_or(Error::PuzzleNotFound)?;

        if puzzle.status == PuzzleStatus::Finalized {
            return Err(Error::PuzzleAlreadyFinalized);
        }
        if puzzle.status != PuzzleStatus::Revealed {
            return Err(Error::AnswerNotRevealed);
        }

        // Suppress unused-variable warning; the parameter is part of the required
        // public interface but scoring covers all players.
        let _ = player;

        let answer = puzzle.answer.clone();

        let players: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::PlayerList(puzzle_id))
            .unwrap_or_else(|| Vec::new(&env));

        let mut winner_count: u32 = 0;

        for p in players.iter() {
            let attempts: Vec<Attempt> = env
                .storage()
                .persistent()
                .get(&DataKey::Attempts(puzzle_id, p.clone()))
                .unwrap_or_else(|| Vec::new(&env));

            let len = attempts.len();
            let mut scored: Vec<Attempt> = Vec::new(&env);
            let mut player_won = false;

            for i in 0..len {
                let att = attempts.get(i).unwrap();
                let scores = score_guess(&env, &att.guess, &answer);
                let solved = is_all_correct(&scores);
                if solved {
                    player_won = true;
                }
                scored.push_back(Attempt {
                    guess: att.guess,
                    scores,
                });
            }

            persist_set(&env, DataKey::Attempts(puzzle_id, p.clone()), &scored);

            if player_won {
                persist_set(&env, DataKey::Winner(puzzle_id, p.clone()), &true);
                winner_count = winner_count.checked_add(1).ok_or(Error::Overflow)?;
            }
        }

        puzzle.status = PuzzleStatus::Finalized;
        puzzle.winner_count = winner_count;
        persist_set(&env, DataKey::Puzzle(puzzle_id), &puzzle);

        PuzzleFinalized {
            puzzle_id,
            answer,
            winner_count,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // get_attempts
    // -----------------------------------------------------------------------

    /// Return all attempts (with scores after finalization) for a player.
    pub fn get_attempts(env: Env, player: Address, puzzle_id: u64) -> Vec<Attempt> {
        env.storage()
            .persistent()
            .get(&DataKey::Attempts(puzzle_id, player))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // -----------------------------------------------------------------------
    // View helpers
    // -----------------------------------------------------------------------

    /// Returns puzzle metadata, or `None` if not found.
    pub fn get_puzzle(env: Env, puzzle_id: u64) -> Option<PuzzleData> {
        env.storage().persistent().get(&DataKey::Puzzle(puzzle_id))
    }

    /// Returns `true` if the player solved the puzzle.
    pub fn is_winner(env: Env, puzzle_id: u64, player: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Winner(puzzle_id, player))
            .unwrap_or(false)
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Score a guess against the answer using the standard Wordle algorithm.
///
/// 1. First pass: mark exact matches (CORRECT).
/// 2. Second pass: for remaining positions, check if the guess letter exists
///    in the remaining answer characters (PRESENT), consuming each answer
///    letter at most once.
pub fn score_guess(env: &Env, guess: &Bytes, answer: &Bytes) -> Vec<u32> {
    let mut scores: [u32; 5] = [SCORE_ABSENT; 5];
    let mut answer_used: [bool; 5] = [false; 5];
    let mut guess_matched: [bool; 5] = [false; 5];

    // Pass 1 — exact matches.
    for i in 0..WORD_LENGTH as usize {
        if guess.get(i as u32) == answer.get(i as u32) {
            scores[i] = SCORE_CORRECT;
            answer_used[i] = true;
            guess_matched[i] = true;
        }
    }

    // Pass 2 — present-but-wrong-position.
    for i in 0..WORD_LENGTH as usize {
        if guess_matched[i] {
            continue;
        }
        let g = guess.get(i as u32).unwrap_or(0);
        for (j, used) in answer_used.iter_mut().enumerate() {
            if *used {
                continue;
            }
            if answer.get(j as u32).unwrap_or(1) == g {
                scores[i] = SCORE_PRESENT;
                *used = true;
                break;
            }
        }
    }

    let mut result: Vec<u32> = Vec::new(env);
    for &s in scores.iter() {
        result.push_back(s);
    }
    result
}

/// Returns `true` when every score in the vec is `SCORE_CORRECT`.
fn is_all_correct(scores: &Vec<u32>) -> bool {
    for i in 0..scores.len() {
        if scores.get(i).unwrap_or(0) != SCORE_CORRECT {
            return false;
        }
    }
    scores.len() == WORD_LENGTH
}

/// Persist a value in persistent storage and extend its TTL.
fn persist_set<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(env: &Env, key: DataKey, val: &V) {
    env.storage().persistent().set(&key, val);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);
}

fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Bytes, BytesN, Env, IntoVal};

    fn sha256_of(env: &Env, data: &[u8]) -> BytesN<32> {
        let b = Bytes::from_slice(env, data);
        env.crypto().sha256(&b).into()
    }

    fn bytes5(env: &Env, data: &[u8; 5]) -> Bytes {
        Bytes::from_slice(env, data)
    }

    fn setup(env: &Env) -> (WordleCloneClient<'_>, Address, Address, Address) {
        let id = env.register(WordleClone, ());
        let client = WordleCloneClient::new(env, &id);
        let admin = Address::generate(env);
        let prize_pool = Address::generate(env);
        let balance = Address::generate(env);
        env.mock_all_auths();
        client.init(&admin, &prize_pool, &balance);
        (client, admin, prize_pool, balance)
    }

    // ------------------------------------------------------------------
    // 1. Happy path: create → submit (winner + loser) → reveal → finalize
    // ------------------------------------------------------------------

    #[test]
    fn test_full_happy_path() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let answer: [u8; 5] = *b"CRANE";
        let commitment = sha256_of(&env, &answer);
        client.create_daily_puzzle(&1u64, &commitment);

        let winner = Address::generate(&env);
        let loser = Address::generate(&env);

        client.submit_attempt(&winner, &1u64, &bytes5(&env, b"CRANE"));
        client.submit_attempt(&loser, &1u64, &bytes5(&env, b"STALE"));

        client.reveal_answer(&1u64, &bytes5(&env, b"CRANE"));
        client.finalize_result(&winner, &1u64);

        let puzzle = client.get_puzzle(&1u64).unwrap();
        assert_eq!(puzzle.winner_count, 1);
        assert_eq!(puzzle.status, PuzzleStatus::Finalized);

        assert!(client.is_winner(&1u64, &winner));
        assert!(!client.is_winner(&1u64, &loser));
    }

    // ------------------------------------------------------------------
    // 2. Scoring — all correct
    // ------------------------------------------------------------------

    #[test]
    fn test_scoring_all_correct() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"PIANO");
        client.create_daily_puzzle(&2u64, &commitment);

        let player = Address::generate(&env);
        client.submit_attempt(&player, &2u64, &bytes5(&env, b"PIANO"));

        client.reveal_answer(&2u64, &bytes5(&env, b"PIANO"));
        client.finalize_result(&player, &2u64);

        let attempts = client.get_attempts(&player, &2u64);
        assert_eq!(attempts.len(), 1);
        let att = attempts.get(0).unwrap();
        for i in 0..WORD_LENGTH {
            assert_eq!(att.scores.get(i).unwrap(), SCORE_CORRECT);
        }
    }

    // ------------------------------------------------------------------
    // 3. Scoring — present and absent letters
    // ------------------------------------------------------------------

    #[test]
    fn test_scoring_present_and_absent() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        // answer: CRANE, guess: NACRE — every letter is in the answer
        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&3u64, &commitment);

        let player = Address::generate(&env);
        client.submit_attempt(&player, &3u64, &bytes5(&env, b"NACRE"));

        client.reveal_answer(&3u64, &bytes5(&env, b"CRANE"));
        client.finalize_result(&player, &3u64);

        let attempts = client.get_attempts(&player, &3u64);
        let att = attempts.get(0).unwrap();
        assert_eq!(att.scores.len(), WORD_LENGTH);
        // No score should be ABSENT since every letter is in CRANE.
        for i in 0..WORD_LENGTH {
            assert!(att.scores.get(i).unwrap() >= SCORE_PRESENT);
        }
    }

    // ------------------------------------------------------------------
    // 4. Max attempts enforced
    // ------------------------------------------------------------------

    #[test]
    fn test_max_attempts_enforced() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&4u64, &commitment);

        let player = Address::generate(&env);
        for _ in 0..MAX_ATTEMPTS {
            client.submit_attempt(&player, &4u64, &bytes5(&env, b"STALE"));
        }

        let result = client.try_submit_attempt(&player, &4u64, &bytes5(&env, b"STALE"));
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 5. Invalid word length rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_invalid_word_length_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&5u64, &commitment);

        let player = Address::generate(&env);
        let short = Bytes::from_slice(&env, b"HI");
        let result = client.try_submit_attempt(&player, &5u64, &short);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 6. Submit to non-existent puzzle rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_submit_to_nonexistent_puzzle() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let player = Address::generate(&env);
        let result = client.try_submit_attempt(&player, &99u64, &bytes5(&env, b"CRANE"));
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 7. Commitment mismatch on reveal rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_commitment_mismatch_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&6u64, &commitment);

        let result = client.try_reveal_answer(&6u64, &bytes5(&env, b"STALE"));
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 8. Non-admin cannot create puzzle
    // ------------------------------------------------------------------

    #[test]
    fn test_non_admin_cannot_create_puzzle() {
        let env = Env::default();
        let (client, admin, prize_pool, balance) = setup(&env);

        let id2 = env.register(WordleClone, ());
        let client2 = WordleCloneClient::new(&env, &id2);
        env.mock_all_auths();
        client2.init(&admin, &prize_pool, &balance);

        let imposter = Address::generate(&env);
        let commitment = sha256_of(&env, b"CRANE");

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &imposter,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &id2,
                fn_name: "create_daily_puzzle",
                args: soroban_sdk::vec![
                    &env,
                    7u64.into_val(&env),
                    commitment.clone().into_val(&env),
                ],
                sub_invokes: &[],
            },
        }]);

        let result = client2.try_create_daily_puzzle(&7u64, &commitment);
        assert!(result.is_err());

        let _ = client;
    }

    // ------------------------------------------------------------------
    // 9. Non-admin cannot finalize
    // ------------------------------------------------------------------

    #[test]
    fn test_non_admin_cannot_finalize() {
        let env = Env::default();
        let (client, admin, prize_pool, balance) = setup(&env);

        let id2 = env.register(WordleClone, ());
        let client2 = WordleCloneClient::new(&env, &id2);
        env.mock_all_auths();
        client2.init(&admin, &prize_pool, &balance);

        let commitment = sha256_of(&env, b"CRANE");
        client2.create_daily_puzzle(&8u64, &commitment);
        client2.reveal_answer(&8u64, &bytes5(&env, b"CRANE"));

        let imposter = Address::generate(&env);
        let dummy_player = Address::generate(&env);

        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &imposter,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &id2,
                fn_name: "finalize_result",
                args: soroban_sdk::vec![
                    &env,
                    dummy_player.clone().into_val(&env),
                    8u64.into_val(&env),
                ],
                sub_invokes: &[],
            },
        }]);

        let result = client2.try_finalize_result(&dummy_player, &8u64);
        assert!(result.is_err());

        let _ = client;
    }

    // ------------------------------------------------------------------
    // 10. Cannot init twice
    // ------------------------------------------------------------------

    #[test]
    fn test_cannot_init_twice() {
        let env = Env::default();
        let (client, admin, prize_pool, balance) = setup(&env);
        env.mock_all_auths();

        let result = client.try_init(&admin, &prize_pool, &balance);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 11. Duplicate puzzle_id rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_duplicate_puzzle_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&10u64, &commitment);

        let result = client.try_create_daily_puzzle(&10u64, &commitment);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 12. Submit to revealed (pre-finalized) puzzle rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_submit_after_reveal_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&11u64, &commitment);
        client.reveal_answer(&11u64, &bytes5(&env, b"CRANE"));

        let late = Address::generate(&env);
        let result = client.try_submit_attempt(&late, &11u64, &bytes5(&env, b"CRANE"));
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 13. Submit to finalized puzzle rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_submit_after_finalize_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&20u64, &commitment);
        client.reveal_answer(&20u64, &bytes5(&env, b"CRANE"));

        let dummy = Address::generate(&env);
        client.finalize_result(&dummy, &20u64);

        let late = Address::generate(&env);
        let result = client.try_submit_attempt(&late, &20u64, &bytes5(&env, b"CRANE"));
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 14. Double finalize rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_double_finalize_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&12u64, &commitment);
        client.reveal_answer(&12u64, &bytes5(&env, b"CRANE"));

        let dummy = Address::generate(&env);
        client.finalize_result(&dummy, &12u64);

        let result = client.try_finalize_result(&dummy, &12u64);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 15. Player who solves on 6th guess is still a winner
    // ------------------------------------------------------------------

    #[test]
    fn test_winner_on_last_guess() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&13u64, &commitment);

        let player = Address::generate(&env);
        for _ in 0..(MAX_ATTEMPTS - 1) {
            client.submit_attempt(&player, &13u64, &bytes5(&env, b"STALE"));
        }
        client.submit_attempt(&player, &13u64, &bytes5(&env, b"CRANE"));

        client.reveal_answer(&13u64, &bytes5(&env, b"CRANE"));
        client.finalize_result(&player, &13u64);

        assert!(client.is_winner(&13u64, &player));
    }

    // ------------------------------------------------------------------
    // 16. get_attempts returns empty vec for unknown player
    // ------------------------------------------------------------------

    #[test]
    fn test_get_attempts_no_submissions() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&14u64, &commitment);

        let stranger = Address::generate(&env);
        let attempts = client.get_attempts(&stranger, &14u64);
        assert_eq!(attempts.len(), 0);
    }

    // ------------------------------------------------------------------
    // 17. Finalize without reveal is rejected
    // ------------------------------------------------------------------

    #[test]
    fn test_finalize_without_reveal_rejected() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&15u64, &commitment);

        let dummy = Address::generate(&env);
        let result = client.try_finalize_result(&dummy, &15u64);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------
    // 18. Scoring unit test — duplicate letters (SPEED / EERIE)
    //
    // answer: S P E E D
    // guess:  E E R I E
    //
    // Pass 1 (exact): no exact matches.
    // Pass 2 (present):
    //   pos 0 (E): matches answer[2]=E → PRESENT, answer[2] consumed.
    //   pos 1 (E): matches answer[3]=E → PRESENT, answer[3] consumed.
    //   pos 2 (R): no match → ABSENT.
    //   pos 3 (I): no match → ABSENT.
    //   pos 4 (E): both answer E's consumed → ABSENT.
    // ------------------------------------------------------------------

    #[test]
    fn test_scoring_duplicate_letters() {
        let env = Env::default();

        let answer = Bytes::from_slice(&env, b"SPEED");
        let guess = Bytes::from_slice(&env, b"EERIE");

        let scores = score_guess(&env, &guess, &answer);

        assert_eq!(scores.get(0).unwrap(), SCORE_PRESENT); // E → present (answer[2])
        assert_eq!(scores.get(1).unwrap(), SCORE_PRESENT); // E → present (answer[3])
        assert_eq!(scores.get(2).unwrap(), SCORE_ABSENT); // R → absent
        assert_eq!(scores.get(3).unwrap(), SCORE_ABSENT); // I → absent
        assert_eq!(scores.get(4).unwrap(), SCORE_ABSENT); // E → absent (both E's used)
    }

    // ------------------------------------------------------------------
    // 19. Multiple winners all recorded
    // ------------------------------------------------------------------

    #[test]
    fn test_multiple_winners() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        env.mock_all_auths();

        let commitment = sha256_of(&env, b"CRANE");
        client.create_daily_puzzle(&16u64, &commitment);

        let w1 = Address::generate(&env);
        let w2 = Address::generate(&env);
        let loser = Address::generate(&env);

        client.submit_attempt(&w1, &16u64, &bytes5(&env, b"CRANE"));
        client.submit_attempt(&w2, &16u64, &bytes5(&env, b"CRANE"));
        client.submit_attempt(&loser, &16u64, &bytes5(&env, b"STALE"));

        client.reveal_answer(&16u64, &bytes5(&env, b"CRANE"));
        client.finalize_result(&w1, &16u64);

        let puzzle = client.get_puzzle(&16u64).unwrap();
        assert_eq!(puzzle.winner_count, 2);
        assert!(client.is_winner(&16u64, &w1));
        assert!(client.is_winner(&16u64, &w2));
        assert!(!client.is_winner(&16u64, &loser));
    }
}
