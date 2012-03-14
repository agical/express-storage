/*
 * express-storage
 * https://github.com/5apps/express-storage
 *
 * Copyright (c) 2012 Michiel De Jong, Sebastian Kippe, Garret Alfert
 * Licensed under the MIT license.
 */

exports.storage = (function() {
  var config = require('../../config').config;//got some problems with my .gitignore
  var redisClient = require('redis').createClient(config.redisPort, config.redisHost).on("error", console.log).auth(config.redisPwd);

  function checkToken(userId, token, category, method, callback) {
    if (category == 'public' && method == 'GET') {
      console.log('public GET access ok');
      callback(true);
    } else {
      console.log('looking for "'+category+'" in key "token:'+userId+':'+token+'"');

      redisClient.get('token:'+userId+':'+token, function(err, categoriesStr) {
        var categories;
        try {
          categories = categoriesStr.split(',');
        } catch(e) {
          console.log('5-0');
          callback(false);
          return;
        }

        console.log('For user "'+userId+'", token "'+token+'", wanting "'+category+'", found categories: '+JSON.stringify(categories));

        var i;
        for(i in categories) {
          console.log('considering '+categories[i]);
          if(categories[i] == category) {
            callback(true);
            return;
          }
        }

        console.log('sorry');
        callback(false);
      });
    }
  }

  function doReq(reqObj, callback) {
    initRedis(function(redisClient){
      checkToken(reqObj.userId, reqObj.token, reqObj.category, reqObj.method, function(result) {
        if (result) {
          if (reqObj.method=='GET') {
            console.log('it\'s a GET');
            redisClient.get('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, function(err, value) {
              console.log('redis says:');console.log(err);console.log(value);
              callback(200, value);
            });
          } else if (reqObj.method=='PUT') {
            console.log('it\'s a PUT');
            redisClient.set('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, reqObj.value, function(err, data) {
              console.log('redis says:');console.log(err);console.log(data);
              callback(200, data);
            });
          } else if (reqObj.method=='DELETE') {
            console.log('it\'s a DELETE');
            redisClient.del('value:'+reqObj.userId+':'+reqObj.category+':'+reqObj.key, function(err, data) {
              console.log('redis says:');console.log(err);console.log(data);
              callback(200);
            });
          }
        } else {
          callback(403);
        }
      });
    });
  }

  function addToken(userId, token, categories, callback) {
    initRedis(function(redisClient){
      console.log('created token "'+token+'" for user "'+userId+'", categories: '+JSON.stringify(categories));
      redisClient.set('token:'+userId+':'+token, JSON.stringify(categories), function(err, data) {
        callback();
      });
    });
  }

  function removeToken(userId, token, callback) {
    initRedis(function(redisClient){
      console.log('removed token "'+token+'" for user "'+userId+'", categories: '+JSON.stringify(categories));
      redisClient.del('token:'+userId+':'+token, function(err, data) {
        callback();
      });
    });
  }

  function onWhiteList(userAddress) {
    return /^([a-z0-9_\.\-])+\@(([a-z0-9\-])+\.)+([a-z0-9]{2,4})+$/.test(userAddress);
  }
  function checkAssertion(userAddress, assertion) {
    return true;
  }
  function extractApp(redirectUri) {
    var urlObj=url.parse(redirectUri);
    if(urlObj.protocol=='http:') {
      return 'http://'+url.host+':'+(urlObj.port?urlObj.port:80);
    } else if(urlObj.protocol=='https:') {
      return 'https://'+url.host+':'+(urlObj.port?urlObj.port:443);
    } else {//TODO: support chrome-extension:// and similar URLs
      return false;
    }
  }
  function extractCategories(scope) {
    if(/^([a-z,])+$/.test(scope)) {
      return scope.toLower().split(',');
    } else {
      return false;
    }
  }
  function checkUserInput(userInput) {
    var categories=[],
      app;
    if(typeof(userInput != 'object')) {
      console.log('userInput is not an object');
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
      //careful that details.app is last so even if it contained one ':' too many, it wouldn't overflow into any of the other fields:
      var tokenName=details.userAddress+':'+JSON.stringify(details.categories)+':'+details.app;
      redisClient.get('tokens:'+details.userAddress, function(err, data) {
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
          if(typeof(tokens[app]==undefined) {
          if(token) {
            console.log('exists');
            callback(null, details.redirectUriPrefix+token);
          } else {
            console.log('generating');
            token = generateToken();
            redisClient.set('token:'+tokenName, token, function(err2) {
              if(err2) {
                callback(err2);
              } else {
                callback(null, details.redirectUriPrefix+token);
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
    doReq: doReq
  };
})();
