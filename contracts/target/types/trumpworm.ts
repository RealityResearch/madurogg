/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/trumpworm.json`.
 */
export type Trumpworm = {
  "address": "Hqp3bwuxLTJGjsacPzo7Q2bpW9snYyDzxQXq1gY1e9EK",
  "metadata": {
    "name": "trumpworm",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "TRUMPWORM.IO Reward Distribution Contract"
  },
  "docs": [
    "MADURO.GG - Trustless Prize Pool Escrow",
    "",
    "Simple escrow contract for hourly reward distribution:",
    "1. Treasury PDA holds the prize pool (not a personal wallet)",
    "2. Server calls distribute_rewards with top 10 wallet addresses",
    "3. Contract transfers tokens directly - all visible on Solscan",
    "4. Anyone can deposit to prize pool (from creator fees)"
  ],
  "instructions": [
    {
      "name": "deposit",
      "docs": [
        "Deposit tokens into the prize pool (anyone can call)"
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "prizePool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "distributeRewards",
      "docs": [
        "Distribute rewards to top players (authority only)",
        "Called hourly by the game server"
      ],
      "discriminator": [
        97,
        6,
        227,
        255,
        124,
        165,
        3,
        148
      ],
      "accounts": [
        {
          "name": "prizePool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amounts",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the prize pool treasury"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "prizePool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "transferAuthority",
      "docs": [
        "Transfer authority to new wallet"
      ],
      "discriminator": [
        48,
        169,
        76,
        72,
        229,
        180,
        55,
        161
      ],
      "accounts": [
        {
          "name": "prizePool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "newAuthority"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "docs": [
        "Emergency withdrawal (authority only)"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "prizePool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  122,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "prize_pool.token_mint",
                "account": "prizePool"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "prizePool",
      "discriminator": [
        51,
        88,
        38,
        85,
        206,
        166,
        162,
        156
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: Only authority can perform this action"
    },
    {
      "code": 6001,
      "name": "zeroAmount",
      "msg": "Cannot deposit zero tokens"
    },
    {
      "code": 6002,
      "name": "tooManyRecipients",
      "msg": "Too many recipients (max 10)"
    },
    {
      "code": 6003,
      "name": "recipientMismatch",
      "msg": "Number of amounts must match number of recipient accounts"
    }
  ],
  "types": [
    {
      "name": "prizePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "totalDistributed",
            "type": "u64"
          },
          {
            "name": "distributionCount",
            "type": "u64"
          },
          {
            "name": "lastDistribution",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
