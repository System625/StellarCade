#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

fn setup(env: &Env) -> (EmergencyPauseClient<'_>, Address, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(EmergencyPause, ());
    let client = EmergencyPauseClient::new(env, &contract_id);

    env.mock_all_auths();
    client.init(&admin);

    (client, admin, contract_id)
}

// -------------------------------------------------------------------
// 1. Initialization
// -------------------------------------------------------------------

#[test]
fn test_init_sets_unpaused() {
    let env = Env::default();
    let (client, _, _) = setup(&env);

    assert!(!client.is_paused());
}

#[test]
fn test_init_rejects_reinit() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    let result = client.try_init(&admin);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 2. Pause / unpause happy path
// -------------------------------------------------------------------

#[test]
fn test_pause_and_unpause() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());
}

// -------------------------------------------------------------------
// 3. Duplicate transitions rejected
// -------------------------------------------------------------------

#[test]
fn test_pause_when_already_paused_errors() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin);
    let result = client.try_pause(&admin);
    assert!(result.is_err());
}

#[test]
fn test_unpause_when_not_paused_errors() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    let result = client.try_unpause(&admin);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 4. Authorization: non-admin cannot pause/unpause
// -------------------------------------------------------------------

#[test]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _admin, _) = setup(&env);
    env.mock_all_auths();

    let stranger = Address::generate(&env);
    let result = client.try_pause(&stranger);
    assert!(result.is_err());
}

#[test]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin);

    let stranger = Address::generate(&env);
    let result = client.try_unpause(&stranger);
    assert!(result.is_err());
}

// -------------------------------------------------------------------
// 5. require_not_paused guard
// -------------------------------------------------------------------

#[test]
fn test_require_not_paused_passes_when_unpaused() {
    let env = Env::default();
    let (_client, _admin, contract_id) = setup(&env);

    // Must run inside contract context to access instance storage
    env.as_contract(&contract_id, || {
        require_not_paused(&env);
    });
}

#[test]
#[should_panic(expected = "EmergencyPause: contract is paused")]
fn test_require_not_paused_panics_when_paused() {
    let env = Env::default();
    let (client, admin, contract_id) = setup(&env);
    env.mock_all_auths();

    client.pause(&admin);
    env.as_contract(&contract_id, || {
        require_not_paused(&env);
    });
}

// -------------------------------------------------------------------
// 6. Full cycle: pause → unpause → pause again
// -------------------------------------------------------------------

#[test]
fn test_full_pause_cycle() {
    let env = Env::default();
    let (client, admin, _) = setup(&env);
    env.mock_all_auths();

    assert!(!client.is_paused());

    client.pause(&admin);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());

    // Can pause again after unpausing
    client.pause(&admin);
    assert!(client.is_paused());
}
