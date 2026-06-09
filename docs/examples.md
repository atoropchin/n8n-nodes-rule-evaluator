# Workflow Examples

These examples demonstrate how to use the **Business Rules** and **Decision Table** nodes in real-world scenarios. 

You can copy the JSON code blocks below and paste them directly into your n8n canvas (`Ctrl+V` or `Cmd+V`) to import the workflows instantly.

## Business Rules

### Chat Gate with Approval Flow

This workflow demonstrates a chat gate with built-in routing. It evaluates rules and routes the message to:
1. **Allow**: Immediately answers the user.
2. **Escalate**: Requests human approval before answering or denying.
3. **Deny**: Rejects the request immediately.

<details>
  <summary><b>Show workflow JSON (copy & paste into n8n)</b></summary>

  ```json
  {
    "nodes": [
      {
        "id": "322bdd85-7028-4fc5-abb6-8eb97c9ce06c",
        "name": "When chat message received",
        "parameters": {
          "options": {
            "responseMode": "responseNodes"
          }
        },
        "position": [0, 128],
        "type": "@n8n/n8n-nodes-langchain.chatTrigger",
        "typeVersion": 1.4
      },
      {
        "id": "2396b0a0-755c-43aa-9378-d72daeba057f",
        "name": "Business Rules",
        "parameters": {
          "options": {},
          "rules": {
            "ruleBlock": [
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "abbb76c0-d025-43a5-8021-33e9973426e9",
                      "leftValue": "1",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "1"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                }
              },
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "f228450f-4b95-42bc-8f78-a8ca0fd7fe75",
                      "leftValue": "1",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "2"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "decision": "escalate"
              }
            ]
          }
        },
        "position": [224, 112],
        "type": "CUSTOM.businessRules",
        "typeVersion": 1
      },
      {
        "id": "d05a41ed-c4c0-4815-b9e1-406127ad564b",
        "name": "Request Approval",
        "parameters": {
          "approvalOptions": {
            "values": {
              "approvalType": "double"
            }
          },
          "message": "Your approval is required to proceed.",
          "operation": "sendAndWait",
          "options": {},
          "responseType": "approval"
        },
        "position": [448, 128],
        "type": "@n8n/n8n-nodes-langchain.chat",
        "typeVersion": 1.3
      },
      {
        "id": "1ca0da35-b059-4425-b06b-a830122a07c9",
        "name": "Switch",
        "parameters": {
          "options": {},
          "rules": {
            "values": [
              {
                "conditions": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "093b6cfa-de8f-4c91-9062-635e7f1146b0",
                      "leftValue": "={{ $json.data.approved }}",
                      "operator": {
                        "operation": "true",
                        "singleValue": true,
                        "type": "boolean"
                      },
                      "rightValue": false
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "outputKey": "true",
                "renameOutput": true
              },
              {
                "conditions": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "6451262e-760d-4335-9f40-a8135747a845",
                      "leftValue": "={{ $json.data.approved }}",
                      "operator": {
                        "operation": "equals",
                        "type": "boolean"
                      },
                      "rightValue": false
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "outputKey": "false",
                "renameOutput": true
              }
            ]
          }
        },
        "position": [672, 128],
        "type": "n8n-nodes-base.switch",
        "typeVersion": 3.4
      },
      {
        "id": "5f171fa1-37e0-4432-8c74-64972ed02cf7",
        "name": "Answer",
        "parameters": {
          "message": "Hi! Request allowed.",
          "options": {}
        },
        "position": [896, 0],
        "type": "@n8n/n8n-nodes-langchain.chat",
        "typeVersion": 1.3
      },
      {
        "id": "6999c14e-e90b-425b-90f0-89ad3c19c138",
        "name": "Not Permitted",
        "parameters": {
          "message": "Access denied.",
          "options": {}
        },
        "position": [896, 240],
        "type": "@n8n/n8n-nodes-langchain.chat",
        "typeVersion": 1.3
      }
    ],
    "connections": {
      "Business Rules": {
        "main": [
          [
            {
              "node": "Answer",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Request Approval",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Not Permitted",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Request Approval": {
        "main": [
          [
            {
              "node": "Switch",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Switch": {
        "main": [
          [
            {
              "node": "Answer",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Not Permitted",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "When chat message received": {
        "main": [
          [
            {
              "node": "Business Rules",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    }
  }
  ```
</details>

### E-commerce Refund Request

This workflow models a "Refund Request" process where the **Business Rules** node acts as a central decision engine. It evaluates the request and routes it to one of five outcomes:

1. **Allow**: The request is valid, proceed with the refund.
2. **Deny**: The request is invalid (e.g., outside the return window), reject immediately.
3. **Escalate**: Requires manual review by a manager.
4. **Silent**: Waiting for the user to provide more information (e.g., photos of the item).
5. **Error**: Something went wrong (e.g., calculation error), notify administrators.

<details>
  <summary><b>Show workflow JSON (copy & paste into n8n)</b></summary>

  ```json
  {
    "nodes": [
      {
        "id": "0f79fb8b-d2d9-4f28-a781-9fbfe212d88e",
        "name": "Submit Request",
        "parameters": {},
        "position": [0, 496],
        "type": "n8n-nodes-base.manualTrigger",
        "typeVersion": 1
      },
      {
        "id": "2575f763-0166-4d36-9cab-dc2f4278ff30",
        "name": "Decision Cube",
        "parameters": {
          "options": {},
          "rules": {
            "ruleBlock": [
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "rule1",
                      "leftValue": "={{ $json.status }}",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "valid"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                }
              },
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "rule2",
                      "leftValue": "={{ $json.status }}",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "invalid"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "decision": "deny"
              },
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "rule3",
                      "leftValue": "={{ $json.status }}",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "needs_review"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "decision": "escalate"
              },
              {
                "condition": {
                  "combinator": "and",
                  "conditions": [
                    {
                      "id": "rule4",
                      "leftValue": "={{ $json.status }}",
                      "operator": {
                        "name": "filter.operator.equals",
                        "operation": "equals",
                        "type": "string"
                      },
                      "rightValue": "waiting"
                    }
                  ],
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "maxConditions": 1,
                    "typeValidation": "strict",
                    "version": 3
                  }
                },
                "decision": "silent"
              }
            ]
          }
        },
        "position": [224, 464],
        "type": "CUSTOM.businessRules",
        "typeVersion": 1
      },
      {
        "id": "eebdf352-7558-47bf-82cf-aac7508e42c2",
        "name": "Process Refund (AI)",
        "parameters": {
          "options": {},
          "promptType": "define",
          "text": "Process the refund for the user."
        },
        "position": [448, 0],
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 3.1
      },
      {
        "id": "f0945708-3727-4624-bd71-838a83dd8f67",
        "name": "OpenAI Model",
        "parameters": {
          "builtInTools": {},
          "model": {
            "__rl": true,
            "mode": "list",
            "value": "gpt-5-mini"
          },
          "options": {}
        },
        "position": [520, 224],
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1.3
      },
      {
        "id": "0d0f4bc3-c5da-4c74-b88f-f69ac905a2ab",
        "name": "Manager Approval",
        "parameters": {
          "approvalOptions": {
            "values": {
              "approvalType": "double"
            }
          },
          "message": "Please approve this refund request.",
          "operation": "sendAndWait",
          "options": {},
          "responseType": "approval"
        },
        "position": [512, 400],
        "type": "@n8n/n8n-nodes-langchain.chat",
        "typeVersion": 1.3
      },
      {
        "id": "1dffdcec-2802-475b-ba78-7883332d881e",
        "name": "Do Nothing",
        "parameters": {},
        "position": [512, 592],
        "type": "n8n-nodes-base.noOp",
        "typeVersion": 1
      },
      {
        "id": "b1b6f6df-2a49-4461-8aa2-b04394fe39a1",
        "name": "Send Rejection",
        "parameters": {
          "message": "Unfortunately, your refund request has been denied.",
          "options": {}
        },
        "position": [512, 784],
        "type": "@n8n/n8n-nodes-langchain.chat",
        "typeVersion": 1.3
      }
    ],
    "connections": {
      "Decision Cube": {
        "main": [
          [
            {
              "index": 0,
              "node": "Process Refund (AI)",
              "type": "main"
            }
          ],
          [
            {
              "index": 0,
              "node": "Manager Approval",
              "type": "main"
            }
          ],
          [
            {
              "index": 0,
              "node": "Do Nothing",
              "type": "main"
            }
          ],
          [
            {
              "index": 0,
              "node": "Send Rejection",
              "type": "main"
            }
          ],
          []
        ]
      },
      "OpenAI Model": {
        "ai_languageModel": [
          [
            {
              "index": 0,
              "node": "Process Refund (AI)",
              "type": "ai_languageModel"
            }
          ]
        ]
      },
      "Submit Request": {
        "main": [
          [
            {
              "index": 0,
              "node": "Decision Cube",
              "type": "main"
            }
          ]
        ]
      }
    }
  }
  ```
</details>

## Decision Table

### Ticket Routing (First Hit Policy)

This workflow routes support tickets using a **Decision Table** with the `First` hit policy. When several cases match, the top row wins.

| Input | Matched case | Output |
|-------|--------------|--------|
| `{ "status": "pending", "days_open": 10 }` | Stale pending ticket | **escalate** |
| `{ "status": "pending", "days_open": 3 }` | Pending ticket | **wait** |
| `{ "status": "resolved" }` | (none) | **closed** (default) |

Both Case 1 and Case 2 can match a stale pending ticket, but `First` picks Case 1 because it is above Case 2.

<details>
  <summary><b>Show workflow JSON (copy & paste into n8n)</b></summary>

  ```json
  {
    "nodes": [
      {
        "id": "addc0c00-60b5-4781-8c58-af690418a23a",
        "name": "Submit Ticket",
        "position": [0, 192],
        "type": "n8n-nodes-base.manualTrigger",
        "typeVersion": 1
      },
      {
        "id": "bb633016-ed9e-41eb-9d6d-650af6b56dd2",
        "name": "Ticket Routing",
        "parameters": {
          "cases": {
            "caseBlock": [
              {
                "caseName": "Stale pending ticket",
                "conditions": {
                  "conditionBlock": [
                    {
                      "condition": {
                        "combinator": "and",
                        "conditions": [
                          {
                            "id": "c1-status",
                            "leftValue": "={{ $json.status }}",
                            "operator": {
                              "name": "filter.operator.equals",
                              "operation": "equals",
                              "type": "string"
                            },
                            "rightValue": "pending"
                          }
                        ],
                        "options": {
                          "caseSensitive": true,
                          "leftValue": "",
                          "maxConditions": 1,
                          "typeValidation": "strict",
                          "version": 3
                        }
                      }
                    },
                    {
                      "condition": {
                        "combinator": "and",
                        "conditions": [
                          {
                            "id": "c1-days",
                            "leftValue": "={{ $json.days_open }}",
                            "operator": {
                              "operation": "gt",
                              "type": "number"
                            },
                            "rightValue": 7
                          }
                        ],
                        "options": {
                          "caseSensitive": true,
                          "leftValue": "",
                          "maxConditions": 1,
                          "typeValidation": "strict",
                          "version": 3
                        }
                      }
                    }
                  ]
                },
                "decision": "escalate"
              },
              {
                "caseName": "Pending ticket",
                "conditions": {
                  "conditionBlock": [
                    {
                      "condition": {
                        "combinator": "and",
                        "conditions": [
                          {
                            "id": "c2-status",
                            "leftValue": "={{ $json.status }}",
                            "operator": {
                              "name": "filter.operator.equals",
                              "operation": "equals",
                              "type": "string"
                            },
                            "rightValue": "pending"
                          }
                        ],
                        "options": {
                          "caseSensitive": true,
                          "leftValue": "",
                          "maxConditions": 1,
                          "typeValidation": "strict",
                          "version": 3
                        }
                      }
                    }
                  ]
                },
                "decision": "wait"
              }
            ]
          },
          "defaultDecision": "closed",
          "options": {
            "hitPolicy": "FIRST"
          }
        },
        "position": [224, 176],
        "type": "CUSTOM.decisionTable",
        "typeVersion": 1
      },
      {
        "id": "2d9c92b6-a01a-45a8-acf5-ab2ef41b30a1",
        "name": "Escalate Ticket",
        "parameters": {
          "operation": "sendAndWait",
          "options": {}
        },
        "position": [448, 0],
        "type": "n8n-nodes-base.emailSend",
        "typeVersion": 2.1
      },
      {
        "id": "1d7beafd-5892-416b-aa18-ccb44ed09b95",
        "name": "Sleep",
        "parameters": {
          "amount": 1,
          "unit": "days"
        },
        "position": [448, 192],
        "type": "n8n-nodes-base.wait",
        "typeVersion": 1.1
      },
      {
        "id": "65600ab1-0a49-4340-af01-8f18ee84edad",
        "name": "Close ticket",
        "parameters": {
          "options": {}
        },
        "position": [448, 384],
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4
      }
    ],
    "connections": {
      "Submit Ticket": {
        "main": [
          [
            {
              "index": 0,
              "node": "Ticket Routing",
              "type": "main"
            }
          ]
        ]
      },
      "Ticket Routing": {
        "main": [
          [
            {
              "index": 0,
              "node": "Escalate Ticket",
              "type": "main"
            }
          ],
          [
            {
              "index": 0,
              "node": "Sleep",
              "type": "main"
            }
          ],
          [
            {
              "index": 0,
              "node": "Close ticket",
              "type": "main"
            }
          ]
        ]
      }
    }
  }
  ```
</details>