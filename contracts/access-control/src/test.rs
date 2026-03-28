#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{vec, Address, Env, IntoVal, Vec};

#[test]
fn test_init_and_has_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);

    client.init(&admin);

    assert_eq!(client.get_admin(), admin);
    assert!(client.has_role(&ADMIN, &admin));
}

#[test]
fn test_grant_and_revoke_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);

    client.init(&admin);

    // Grant OPERATOR role
    client.grant_role(&OPERATOR, &user);
    assert!(client.has_role(&OPERATOR, &user));

    // Check state
    assert!(client.has_role(&OPERATOR, &user));

    // Revoke role
    client.revoke_role(&OPERATOR, &user);
    assert!(!client.has_role(&OPERATOR, &user));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_already_initialized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);

    client.init(&admin);
    client.init(&admin);
}

#[test]
fn test_non_admin_cannot_grant_role() {
    let env = Env::default();
    
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);

    client.init(&admin);

    env.mock_auths(&[
        soroban_sdk::testutils::MockAuth {
            address: &non_admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract_id,
                fn_name: "grant_role",
                args: vec![&env, OPERATOR.into_val(&env), user.into_val(&env)],
                sub_invokes: &[],
            },
        },
    ]);

    let result = client.try_grant_role(&OPERATOR, &user);
    assert!(result.is_err());
}

#[test]
fn test_duplicate_grant_revoke() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);

    client.init(&admin);

    // Grant twice
    client.grant_role(&OPERATOR, &user);
    assert!(client.has_role(&OPERATOR, &user));
    client.grant_role(&OPERATOR, &user);
    assert!(client.has_role(&OPERATOR, &user));

    // Revoke twice
    client.revoke_role(&OPERATOR, &user);
    assert!(!client.has_role(&OPERATOR, &user));
    client.revoke_role(&OPERATOR, &user);
    assert!(!client.has_role(&OPERATOR, &user));
}

// ── Role member listing ────────────────────────────────────────────────────

#[test]
fn test_role_member_count_empty_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    // A role that has never been granted (other than ADMIN for admin)
    assert_eq!(client.role_member_count(&OPERATOR), 0);
    assert_eq!(client.role_member_count(&GAME), 0);
}

#[test]
fn test_role_member_count_populated() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    assert_eq!(client.role_member_count(&OPERATOR), 0);

    client.grant_role(&OPERATOR, &user1);
    assert_eq!(client.role_member_count(&OPERATOR), 1);

    client.grant_role(&OPERATOR, &user2);
    assert_eq!(client.role_member_count(&OPERATOR), 2);

    client.revoke_role(&OPERATOR, &user1);
    assert_eq!(client.role_member_count(&OPERATOR), 1);
}

#[test]
fn test_list_role_members_ordering_stable() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    // Grant in order: user1, user2, user3
    client.grant_role(&OPERATOR, &user1);
    client.grant_role(&OPERATOR, &user2);
    client.grant_role(&OPERATOR, &user3);

    let members = client.list_role_members(&OPERATOR, &0, &10);
    assert_eq!(members.len(), 3);
    assert_eq!(members.get(0).unwrap(), user1);
    assert_eq!(members.get(1).unwrap(), user2);
    assert_eq!(members.get(2).unwrap(), user3);
}

#[test]
fn test_list_role_members_pagination() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    client.grant_role(&OPERATOR, &user1);
    client.grant_role(&OPERATOR, &user2);
    client.grant_role(&OPERATOR, &user3);

    // Page 1: first 2
    let page1 = client.list_role_members(&OPERATOR, &0, &2);
    assert_eq!(page1.len(), 2);
    assert_eq!(page1.get(0).unwrap(), user1);
    assert_eq!(page1.get(1).unwrap(), user2);

    // Page 2: next 2 (only 1 remains)
    let page2 = client.list_role_members(&OPERATOR, &2, &2);
    assert_eq!(page2.len(), 1);
    assert_eq!(page2.get(0).unwrap(), user3);
}

#[test]
fn test_list_role_members_after_revoke() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    client.grant_role(&OPERATOR, &user1);
    client.grant_role(&OPERATOR, &user2);
    client.revoke_role(&OPERATOR, &user1);

    let members = client.list_role_members(&OPERATOR, &0, &10);
    assert_eq!(members.len(), 1);
    assert_eq!(members.get(0).unwrap(), user2);
}

#[test]
fn test_list_role_members_empty() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.init(&admin);

    let members: Vec<Address> = client.list_role_members(&GAME, &0, &10);
    assert_eq!(members.len(), 0);
}
