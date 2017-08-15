/* Evaluator
 * 	Evaluates the Abstract Syntax Tree for Netscript
 *  generated by the Parser class
 */
// Evaluator should return a Promise, so that any call to evaluate() can just
//wait for that promise to finish before continuing
function evaluate(exp, workerScript) {
    return new Promise(function(resolve, reject) {
	var env = workerScript.env;
    if (env.stopFlag) {return reject(workerScript);}
    if (exp == null) {
        return reject(makeRuntimeRejectMsg(workerScript, "Error: NULL expression"));
    }
    setTimeout(function() {
        if (env.stopFlag) {return reject(workerScript);}
        switch (exp.type) {
            case "BlockStatement":
            case "Program":
                var evaluateProgPromise = evaluateProg(exp, workerScript, 0);  //TODO: make every block/program use individual enviroment
                evaluateProgPromise.then(function(w) {
                    resolve(workerScript);
                }, function(e) {
                    if (typeof e === 'string' || e instanceof String) {
                        workerScript.errorMessage = e;
                        reject(workerScript);
                    } else if (e instanceof WorkerScript) {
                        reject(e);
                    } else {
                        reject(workerScript);
                    }
                });
                break;
            case "Literal":
                resolve(exp.value);
                break;
            case "Identifier":
                if (!(exp.name in env.vars)){
                    reject(makeRuntimeRejectMsg(workerScript, "variable " + exp.name + " not definied"));
                }
                resolve(env.get(exp.name))
                break;
            case "ExpressionStatement":
                var e = evaluate(exp.expression, workerScript);
                e.then(function(res) {
                    resolve("expression done");
                }, function(e) {
                    reject(e);
                });
                break;
            case "ArrayExpression":
                var argPromises = exp.elements.map(function(arg) {
                    return evaluate(arg, workerScript);
                });
                Promise.all(argPromises).then(function(array) {
                    resolve(array)
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "CallExpression":
                evaluate(exp.callee, workerScript).then(function(func) {
                    var argPromises = exp.arguments.map(function(arg) {
                        return evaluate(arg, workerScript);
                    });
                    Promise.all(argPromises).then(function(args) {
                        if (exp.callee.type == "MemberExpression"){
                            evaluate(exp.callee.object, workerScript).then(function(object) {
                                try {
                                    var res = func.apply(object,args);
                                    resolve(res);
                                } catch (e) {
                                    reject(makeRuntimeRejectMsg(workerScript, e));
                                }
                            }).catch(function(e) {
                                reject(e);
                            });
                        } else {
                            try {
                                var out = func.apply(null,args);
                                if (out instanceof Promise){
                                    out.then(function(res) {
                                        resolve(res)
                                    }).catch(function(e) {
                                        reject(e);
                                    });
                                } else {
                                    resolve(out);
                                }
                            } catch (e) {
                                if (isScriptErrorMessage(e)) {
                                    reject(e);
                                } else {
                                    reject(makeRuntimeRejectMsg(workerScript, e));
                                }
                            }
                        }
                    }).catch(function(e) {
                        reject(e);
                    });
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "MemberExpression":
                var pObject = evaluate(exp.object, workerScript);
                pObject.then(function(object) {
                    if (exp.computed){
                        var p = evaluate(exp.property, workerScript);
                        p.then(function(index) {
                            if (index >= object.length) {
                                return reject(makeRuntimeRejectMsg(workerScript, "Invalid index for arrays"));
                            }
                            resolve(object[index]);
                        }).catch(function(e) {
                            console.log("here");
                            reject(makeRuntimeRejectMsg(workerScript, "Invalid MemberExpression"));
                        });
                    } else {
                        try {
                            resolve(object[exp.property.name])
                        } catch (e) {
                            return reject(makeRuntimeRejectMsg(workerScript, "Failed to get property: " + e.toString()));
                        }
                    }
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "LogicalExpression":
            case "BinaryExpression":
                var p = evalBinary(exp, workerScript, resolve, reject);
                p.then(function(res) {
                    resolve(res);
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "UnaryExpression":
                var p = evalUnary(exp, workerScript, resolve, reject);
                p.then(function(res) {
                    resolve(res);
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "AssignmentExpression":
                var p = evalAssignment(exp, workerScript);
                p.then(function(res) {
                    resolve(res);
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "UpdateExpression":
                if (exp.argument.type==="Identifier"){
                    if (exp.argument.name in env.vars){
                        if (exp.prefix){
                            resolve(env.get(exp.argument.name))
                        }
                        switch (exp.operator){
                            case "++":
                                env.set(exp.argument.name,env.get(exp.argument.name)+1);
                                break;
                            case "--":
                                env.set(exp.argument.name,env.get(exp.argument.name)-1);
                                break;
                            default:
                                reject(makeRuntimeRejectMsg(workerScript, "Unrecognized token: " + exp.type + ". This is a bug please report to game developer"));
                        }
                        if (env.prefix){
                            return;
                        }
                        resolve(env.get(exp.argument.name))
                    } else {
                        reject(makeRuntimeRejectMsg(workerScript, "variable " + exp.argument.name + " not definied"));
                    }
                } else {
                    reject(makeRuntimeRejectMsg(workerScript, "argument must be an identifier"));
                }
                break;
            case "EmptyStatement":
                resolve(false);
                break;
            case "ReturnStatement":
                reject(makeRuntimeRejectMsg(workerScript, "Not implemented ReturnStatement"));
                break;
            case "BreakStatement":
                reject("BREAKSTATEMENT");
                //reject(makeRuntimeRejectMsg(workerScript, "Not implemented BreakStatement"));
                break;
            case "IfStatement":
                evaluateIf(exp, workerScript).then(function(forLoopRes) {
                    resolve("forLoopDone");
                }).catch(function(e) {
                    reject(e);
                });
                break;
            case "SwitchStatement":
                reject(makeRuntimeRejectMsg(workerScript, "Not implemented SwitchStatement"));
                break;e
            case "WhileStatement":
                evaluateWhile(exp, workerScript).then(function(forLoopRes) {
                    resolve("forLoopDone");
                }).catch(function(e) {
                    if (e == "BREAKSTATEMENT" ||
                       (e instanceof WorkerScript && e.errorMessage == "BREAKSTATEMENT")) {
                        return resolve("whileLoopBroken");
                    } else {
                        reject(e);
                    }
                });
                break;
            case "ForStatement":
                evaluate(exp.init, workerScript).then(function(expInit) {
                    return evaluateFor(exp, workerScript);
                }).then(function(forLoopRes) {
                    resolve("forLoopDone");
                }).catch(function(e) {
                    if (e == "BREAKSTATEMENT" ||
                       (e instanceof WorkerScript && e.errorMessage == "BREAKSTATEMENT")) {
                        return resolve("forLoopBroken");
                    } else {
                        reject(e);
                    }
                });
                break;
            default:
                reject(makeRuntimeRejectMsg(workerScript, "Unrecognized token: " + exp.type + ". This is a bug please report to game developer"));
                break;
        } //End switch
    }, Settings.CodeInstructionRunTime); //End setTimeout, the Netscript operation run time

    }); // End Promise
}

function evalBinary(exp, workerScript){
    return new Promise(function(resolve, reject) {
        var expLeftPromise = evaluate(exp.left, workerScript);
        expLeftPromise.then(function(expLeft) {
            var expRightPromise = evaluate(exp.right, workerScript);
            expRightPromise.then(function(expRight) {
                switch (exp.operator){
                    case "===":
                    case "==":
                        resolve(expLeft===expRight);
                        break;
                    case "!==":
                    case "!=":
                        resolve(expLeft!==expRight);
                        break;
                    case "<":
                        resolve(expLeft<expRight);
                        break;
                    case "<=":
                        resolve(expLeft<=expRight);
                        break;
                    case ">":
                        resolve(expLeft>expRight);
                        break;
                    case ">=":
                        resolve(expLeft>=expRight);
                        break;
                    case "+":
                        resolve(expLeft+expRight);
                        break;
                    case "-":
                        resolve(expLeft-expRight);
                        break;
                    case "*":
                        resolve(expLeft*expRight);
                        break;
                    case "/":
                        resolve(expLeft/expRight);
                        break;
                    case "%":
                        resolve(expLeft%expRight);
                        break;
                    case "in":
                        resolve(expLeft in expRight);
                        break;
                    case "instanceof":
                        resolve(expLeft instanceof expRight);
                        break;
                    case "||":
                        resolve(expLeft || expRight);
                        break;
                    case "&&":
                        resolve(expLeft && expRight);
                        break;
                    default:
                        reject(makeRuntimeRejectMsg(workerScript, "Bitwise operators are not implemented"));
                }
            }, function(e) {
                reject(e);
            });
        }, function(e) {
            reject(e);
        });
    });
}

function evalUnary(exp, workerScript){
    var env = workerScript.env;
    return new Promise(function(resolve, reject) {
        if (env.stopFlag) {return reject(workerScript);}
        var p = evaluate(exp.argument, workerScript);
        p.then(function(res) {
            if (exp.operator == "!") {
                resolve(!res);
            } else if (exp.operator == "-") {
                if (isNaN(res)) {
                    resolve(res);
                } else {
                    resolve(-1 * res);
                }
            } else {
                reject(makeRuntimeRejectMsg(workerScript, "Unimplemented unary operator: " + exp.operator));
            }
        }).catch(function(e) {
            reject(e);
        });
    });
}

function evalAssignment(exp, workerScript) {
    var env = workerScript.env;
    return new Promise(function(resolve, reject) {
        if (env.stopFlag) {return reject(workerScript);}

        if (exp.left.type != "Identifier" && exp.left.type != "MemberExpression") {
            return reject(makeRuntimeRejectMsg(workerScript, "Cannot assign to " + JSON.stringify(exp.left)));
        }

        if (exp.operator !== "=" && !(exp.left.name in env.vars)){
            return reject(makeRuntimeRejectMsg(workerScript, "variable " + exp.left.name + " not definied"));
        }

        var expRightPromise = evaluate(exp.right, workerScript);
        expRightPromise.then(function(expRight) {
            if (exp.left.type == "MemberExpression") {
                //Assign to array element
                //Array object designed by exp.left.object.name
                //Index designated by exp.left.property
                var name = exp.left.object.name;
                if (!(name in env.vars)){
                    reject(makeRuntimeRejectMsg(workerScript, "variable " + name + " not definied"));
                }
                var arr = env.get(name);
                if (arr.constructor === Array || arr instanceof Array) {
                    var iPromise = evaluate(exp.left.property, workerScript);
                    iPromise.then(function(idx) {
                        if (isNaN(idx)) {
                            return reject(makeRuntimeRejectMsg(workerScript, "Invalid access to array. Index is not a number: " + idx));
                        } else if (idx >= arr.length || idx < 0) {
                            return reject(makeRuntimeRejectMsg(workerScript, "Out of bounds: Invalid index in [] operator"));
                        } else {
                            env.setArrayElement(name, idx, expRight);
                        }
                    }).catch(function(e) {
                        return reject(e);
                    });
                } else {
                    return reject(makeRuntimeRejectMsg(workerScript, "Trying to access a non-array variable using the [] operator"));
                }
            } else {
                //Other assignments
                try {
                    switch (exp.operator) {
                        case "=":
                            env.set(exp.left.name,expRight);
                            break;
                        case "+=":
                            env.set(exp.left.name,env.get(exp.left.name) + expRight);
                            break;
                        case "-=":
                            env.set(exp.left.name,env.get(exp.left.name) - expRight);
                            break;
                        case "*=":
                            env.set(exp.left.name,env.get(exp.left.name) * expRight);
                            break;
                        case "/=":
                            env.set(exp.left.name,env.get(exp.left.name) / expRight);
                            break;
                        case "%=":
                            env.set(exp.left.name,env.get(exp.left.name) % expRight);
                            break;
                        default:
                            reject(makeRuntimeRejectMsg(workerScript, "Bitwise assignment is not implemented"));
                    }
                } catch (e) {
                    return reject(makeRuntimeRejectMsg(workerScript, "Failed to set environment variable: " + e.toString()));
                }
            }
            resolve(false); //Return false so this doesnt cause conditionals to evaluate
        }, function(e) {
            reject(e);
        });
    });
}

//Returns true if any of the if statements evaluated, false otherwise. Therefore, the else statement
//should evaluate if this returns false
function evaluateIf(exp, workerScript, i) {
    var env = workerScript.env;
    return new Promise(function(resolve, reject) {
        evaluate(exp.test, workerScript).then(function(condRes) {
            if (condRes) {
                evaluate(exp.consequent, workerScript).then(function(res) {
                    resolve(true);
                }, function(e) {
                    reject(e);
                });
            } else if (exp.alternate) {
                evaluate(exp.alternate, workerScript).then(function(res) {
                    resolve(true);
                }, function(e) {
                    reject(e);
                });
            } else {
                resolve("endIf")
            }
        }, function(e) {
            reject(e);
        });
    });
}

//Evaluate the looping part of a for loop (Initialization block is NOT done in here)
function evaluateFor(exp, workerScript) {
	var env = workerScript.env;
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript); return;}

		var pCond = evaluate(exp.test, workerScript);
		pCond.then(function(resCond) {
			if (resCond) {
				//Run the for loop code
				var pBody = evaluate(exp.body, workerScript);
				//After the code executes make a recursive call
				pBody.then(function(resCode) {
					var pUpdate = evaluate(exp.update, workerScript);
					pUpdate.then(function(resPostloop) {
						var recursiveCall = evaluateFor(exp, workerScript);
						recursiveCall.then(function(foo) {
							resolve("endForLoop");
						}, function(e) {
							reject(e);
						});
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			} else {
				resolve("endForLoop");	//Doesn't need to resolve to any particular value
			}
		}, function(e) {
            reject(e);
		});
	});
}

function evaluateWhile(exp, workerScript) {
	var env = workerScript.env;

	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript); return;}

		var pCond = new Promise(function(resolve, reject) {
			setTimeout(function() {
				var evaluatePromise = evaluate(exp.test, workerScript);
				evaluatePromise.then(function(resCond) {
					resolve(resCond);
				}, function(e) {
					reject(e);
				});
			}, CONSTANTS.CodeInstructionRunTime);
		});

		pCond.then(function(resCond) {
			if (resCond) {
				//Run the while loop code
				var pCode = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var evaluatePromise = evaluate(exp.body, workerScript);
						evaluatePromise.then(function(resCode) {
							resolve(resCode);
						}, function(e) {
                            reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});

				//After the code executes make a recursive call
				pCode.then(function(resCode) {
					var recursiveCall = evaluateWhile(exp, workerScript);
					recursiveCall.then(function(foo) {
						resolve("endWhileLoop");
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			} else {
				resolve("endWhileLoop"); //Doesn't need to resolve to any particular value
			}
		}, function(e) {
			reject(e);
		});
	});
}

function evaluateProg(exp, workerScript, index) {
	var env = workerScript.env;

	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript); return;}

		if (index >= exp.body.length) {
			resolve("progFinished");
		} else {
			//Evaluate this line of code in the prog
			var code = new Promise(function(resolve, reject) {
				setTimeout(function() {
					var evaluatePromise = evaluate(exp.body[index], workerScript);
					evaluatePromise.then(function(evalRes) {
						resolve(evalRes);
					}, function(e) {
						reject(e);
					});
				}, CONSTANTS.CodeInstructionRunTime);
			});

			//After the code finishes evaluating, evaluate the next line recursively
			code.then(function(codeRes) {
				var nextLine = evaluateProg(exp, workerScript, index + 1);
				nextLine.then(function(nextLineRes) {
					resolve(workerScript);
				}, function(e) {
					reject(e);
				});
			}, function(e) {
				reject(e);
			});
		}
	});
}

function netscriptDelay(time) {
   return new Promise(function(resolve) {
       setTimeout(resolve, time);
   });
}

function makeRuntimeRejectMsg(workerScript, msg) {
    return "|"+workerScript.serverIp+"|"+workerScript.name+"|" + msg;
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x != "number")
            throw new Error("Expected number but got " + x);
        return x;
    }
    function div(x) {
        if (num(x) == 0)
            throw new Error("Divide by zero");
        return x;
    }
    switch (op) {
      case "+": return a + b;
      case "-": return num(a) - num(b);
      case "*": return num(a) * num(b);
      case "/": return num(a) / div(b);
      case "%": return num(a) % div(b);
      case "&&": return a !== false && b;
      case "||": return a !== false ? a : b;
      case "<": return num(a) < num(b);
      case ">": return num(a) > num(b);
      case "<=": return num(a) <= num(b);
      case ">=": return num(a) >= num(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
}

//Run a script from inside a script using run() command
function runScriptFromScript(server, scriptname, args, workerScript, threads=1) {
    //Check if the script is already running
    var runningScriptObj = findRunningScript(scriptname, args, server);
    if (runningScriptObj != null) {
        workerScript.scriptRef.log(scriptname + " is already running on " + server.hostname);
        return Promise.resolve(false);
    }

    //Check if the script exists and if it does run it
    for (var i = 0; i < server.scripts.length; ++i) {
        if (server.scripts[i].filename == scriptname) {
            //Check for admin rights and that there is enough RAM availble to run
            var script = server.scripts[i];
            var ramUsage = script.ramUsage;
            ramUsage = ramUsage * threads * Math.pow(CONSTANTS.MultithreadingRAMCost, threads-1);
            var ramAvailable = server.maxRam - server.ramUsed;

            if (server.hasAdminRights == false) {
                workerScript.scriptRef.log("Cannot run script " + scriptname + " on " + server.hostname + " because you do not have root access!");
                return Promise.resolve(false);
            } else if (ramUsage > ramAvailable){
                workerScript.scriptRef.log("Cannot run script " + scriptname + "(t=" + threads + ") on " + server.hostname + " because there is not enough available RAM!");
                return Promise.resolve(false);
            } else {
                //Able to run script
                workerScript.scriptRef.log("Running script: " + scriptname + " on " + server.hostname + " with " + threads + " threads and args: " + printArray(args) + ". May take a few seconds to start up...");
                var runningScriptObj = new RunningScript(script, args);
                runningScriptObj.threads = threads;
                server.runningScripts.push(runningScriptObj);	//Push onto runningScripts
                addWorkerScript(runningScriptObj, server);
                return Promise.resolve(true);
            }
        }
    }
    workerScript.scriptRef.log("Could not find script " + scriptname + " on " + server.hostname);
    return Promise.resolve(false);
}

function isScriptErrorMessage(msg) {
    splitMsg = msg.split("|");
    if (splitMsg.length != 4){
        return false;
    }
    var ip = splitMsg[1];
    if (!isValidIPAddress(ip)) {
        return false;
    }
    return true;
}

//The same as Player's calculateHackingChance() function but takes in the server as an argument
function scriptCalculateHackingChance(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (1.75 * Player.hacking_skill);
    var skillChance = (skillMult - server.requiredHackingSkill) / skillMult;
    var chance = skillChance * difficultyMult * Player.hacking_chance_mult;
    if (chance > 1) {return 1;}
    if (chance < 0) {return 0;}
    else {return chance;}
}

//The same as Player's calculateHackingTime() function but takes in the server as an argument
function scriptCalculateHackingTime(server) {
	var difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
	var skillFactor = (2.5 * difficultyMult + 500) / (Player.hacking_skill + 50);
	var hackingTime = 5 * skillFactor / Player.hacking_speed_mult; //This is in seconds
	return hackingTime;
}

//The same as Player's calculateExpGain() function but takes in the server as an argument
function scriptCalculateExpGain(server) {
    if (server.baseDifficulty == null) {
        server.baseDifficulty = server.hackDifficulty;
    }
    return (server.baseDifficulty * Player.hacking_exp_mult * 0.3 + 3);
}

//The same as Player's calculatePercentMoneyHacked() function but takes in the server as an argument
function scriptCalculatePercentMoneyHacked(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (Player.hacking_skill - (server.requiredHackingSkill - 1)) / Player.hacking_skill;
    var percentMoneyHacked = difficultyMult * skillMult * Player.hacking_money_mult / 240;
    if (percentMoneyHacked < 0) {return 0;}
    if (percentMoneyHacked > 1) {return 1;}
    return percentMoneyHacked;
}

//Amount of time to execute grow() in milliseconds
function scriptCalculateGrowTime(server) {
    var difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
	var skillFactor = (2.5 * difficultyMult + 500) / (Player.hacking_skill + 50);
	var growTime = 16 * skillFactor / Player.hacking_speed_mult; //This is in seconds
	return growTime * 1000;
}

//Amount of time to execute weaken() in milliseconds
function scriptCalculateWeakenTime(server) {
    var difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
	var skillFactor = (2.5 * difficultyMult + 500) / (Player.hacking_skill + 50);
	var weakenTime = 20 * skillFactor / Player.hacking_speed_mult; //This is in seconds
	return weakenTime * 1000;
}
