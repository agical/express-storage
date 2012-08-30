/*
 * express-storage
 * https://github.com/5apps/express-storage
 *
 * Copyright (c) 2012 Michiel de Jong, Sebastian Kippe, Garret Alfert
 * Licensed under the MIT license.
 */

exports.storage = (function() {
  var config=require('../../config').config,//got some problems with my .gitignore
    url=require('url'),
    key_value_store = function () {
        var store = {};
        return { 
            on: function(level, fn) {
            },
            auth: function(auth_conf) {
            },
            get: function(key, cb) {
                cb(null, store[key]);
            },
            set: function(key, value, cb) {
                store[key] = value;
                cb(null, null);
            },
            del: function(key, cb) {
                delete store[key];
                cb(null, null);
            },
            data: store
        };
    }();
  key_value_store.on("error", console.log);
  key_value_store.auth(config.redisPwd);
  function checkToken(userAddress, token, category, method, callback) {
    if (category == 'public' && method == 'GET') {
      console.log('public GET access ok');
      callback(true);
    } else {
      var accessType;
      if(method=='GET') {
        accessType='r';
      } else {
        accessType='w';
      }
      console.log('looking for "'+category+'" in key "tokens:'+userAddress+'"');

      key_value_store.get('tokens:'+userAddress, function(err, tokensStr) {
        var tokens,scopes;
        console.log("Token str:", tokensStr);
        try {
          tokens = JSON.parse(tokensStr);
        } catch(e) {
          console.log('DATA CORRUPTION: 5-0');
          callback(false);
          return;
        }
        if(!tokens || !tokens[token]) {
          console.log('access denied');
          callback(false);
          return;
        }
        console.log('the token exists, it give access '+userAddress+' access for app,scope:');
        console.log(tokens[token]);
        if(!tokens[token].scope || typeof(tokens[token].scope) != 'string') {
          console.log('DATA CORRUPTION: no category');
          callback(false);
          return;
        }
        scopes=tokens[token].scope.split(',');

        for(i in scopes) {
          var parts = scopes[i].split(':');
          if(parts.length != 2) {
            console.log('DATA CORRUPTION: no colon in scope-part');
            callback(false);
            return;
          }
          console.log('considering '+parts[0]);
          if(parts[0] == category) {
            for(var i=0;i<parts[1].length;i++) {
              if(parts[1][i]==accessType) {
                callback(true);
                return;
              }
            }
          }
        }
        console.log('sorry');
        callback(false);
      });
    }
  }
  
  function addUser(userId, password, callback) {
      console.log('creating user '+userId+' with password '+password);
      key_value_store.set('user:'+userId, password, function(err, data) {
          callback();
      });
  }


  function doReq(reqObj, callback) {
    checkToken(reqObj.userId, reqObj.token, reqObj.category, reqObj.method, function(result) {
      if (result) {
        if (reqObj.method=='GET') {
          console.log('it\'s a GET');
          key_value_store.get('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, function(err, value) {
            console.log('redis says:');console.log(err);console.log(value);
            callback(200, value);
          });
        } else if (reqObj.method=='PUT') {
          console.log('it\'s a PUT');
          key_value_store.set('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, reqObj.value, function(err, data) {
            console.log('redis says:');console.log(err);console.log(data);
            callback(200, data);
          });
        } else if (reqObj.method=='DELETE') {
          console.log('it\'s a DELETE');
          key_value_store.del('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, function(err, data) {
            console.log('redis says:');console.log(err);console.log(data);
            callback(200);
          });
        }
      } else {
        callback(403);
      }
    });
  }

  function addToken(userId, token, categories, callback) {
    console.log('created token "'+token+'" for user "'+userId+'", categories: '+JSON.stringify(categories));
    key_value_store.set('token:'+userId+':'+token, JSON.stringify(categories), function(err, data) {
      callback();
    });
  }

  function removeToken(userId, token, callback) {
    console.log('removed token "'+token+'" for user "'+userId+'", categories: '+JSON.stringify(categories));
    key_value_store.del('token:'+userId+':'+token, function(err, data) {
      callback();
    });
  }

  function onWhiteList(userAddress) {
    return /^([a-z0-9_\.\-])+\@([a-z0-9\-])+$/.test(userAddress);
  }
  function checkAssertion(userAddress, assertion) {
    return true;
  }
  function extractApp(redirectUri) {
    var urlObj=url.parse(redirectUri);
    if(urlObj.protocol=='http:') {
      return 'http://'+urlObj.hostname+':'+(urlObj.port?urlObj.port:80);
    } else if(urlObj.protocol=='https:') {
      return 'https://'+url.hostname+':'+(urlObj.port?urlObj.port:443);
    } else if(urlObj.protocol=='chrome-extension:') {
      return 'chrome-extension://'+url.hostname;
    } else {//TODO: support chrome-extension:// and similar URLs
      return false;
    }
  }
  function extractCategories(scope) {
    if(/^([a-z,])+$/.test(scope)) {
      var cats=[], strings=scope.toLowerCase().split(',');
      for(var i=0;i<strings.length;i++){
        if(strings[i].length) {
          cats.push(strings[i]+':rw');
        }
      }
      if(cats.length) {
        cats.sort();
        return cats;
      }
    }
    return false;
  }
  function checkUserInput(userInput) {
    var categories, app;
    if(typeof(userInput) != 'object') {
      console.log('userInput is of type '+typeof(userInput));
      return false;
    } else if(typeof(userInput.userAddress) != 'string') {
      console.log('no userAddress');
      return false;
    } else if(typeof(userInput.assertion) != 'string') {
      console.log('no assertion');
      return false;
    } else if(typeof(userInput.scope) != 'string') {
      console.log('no scope');
      return false;
    } else if(typeof(userInput.redirectUri) != 'string') {
      console.log('no redirectUri');
      return false;
    } else if(!onWhiteList(userInput.userAddress)) {//we are allowing anyone who can pass BrowserID on the domains we serve, so we don't have a list of existing users!
      console.log('not on white list');
      return false;
    } else if(!checkAssertion(userInput.userAddress, userInput.assertion)) {//this will give a timing attack on the white list but that's ok because that info is public
      console.log('assertion is wrong');
      return false;
    } else {
      var app=extractApp(userInput.redirectUri);
      var categories=extractCategories(userInput.scope);
      if(app && categories) {
        return {
          userAddress: userInput.userAddress,
          categories: categories,
          app: app,
          redirectUriPrefix: userInput.redirectUri+'#access_token='
        };
      } else {
        console.log('no app or no categories');
        return false;
      }
    }
  }
  function getToken(userInput, callback) {
    console.log(userInput);
    var details=checkUserInput(userInput);
    if(details) {
      console.log('ok');
      key_value_store.get('tokens:'+details.userAddress, function(err, data) {
        if(err) {
          console.log(err);
          callback(err);
        } else {
          var tokens;
          try {
            tokens=JSON.parse(data);
          } catch(e) {
          }
          if(!tokens) {
            tokens={};
          }
          for(var token in tokens) {
            if(tokens[token].app && tokens[token].app==details.app && tokens[token].scope && tokens[token].scope==details.categories.join(',')) {
              console.log('exists');
              callback(null, details.redirectUriPrefix+token);
              return;
            }
          }
          console.log('generating');  
          var newToken=generateToken();
          if(tokens[newToken]) {
            console.log('BUG: hash collision - if this happens more than once every billion years, you have a security vulnerability!');
            callback('hash collision');
          } else {
            tokens[newToken]={
              app: details.app,
              scope: details.categories.join(',')
            };
            console.log(tokens);
            var tokenKey = 'tokens:'+details.userAddress;
            key_value_store.set(tokenKey, JSON.stringify(tokens), function(err2) {
              if(err2) {
                console.log("Could not set tokens ", tokenKey, "=", tokens, ", Cause:", err2);
                callback(err2);
              } else {
                console.log("Stored new token ", tokenKey, "=", tokens, "in redis:", details.redirectUriPrefix+newToken);
                callback(null, details.redirectUriPrefix+newToken);
              }
            });
          }
        }
      });
    }
  }
  function generateToken() {
    var tokenLength = 32;
    var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var token = "";

    for(var i=0; i < tokenLength; i++)
      token += charSet.charAt(Math.floor(Math.random() * charSet.length));

    return token;
  }

  return {
    getToken: getToken,
    removeToken: removeToken,
    doReq: doReq,
    addUser: addUser,
    get: key_value_store.get,
    set: key_value_store.set,
    data: key_value_store.data
  };
})();
