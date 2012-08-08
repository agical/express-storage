// Module dependencies

var express = require('express');
var util = require('util');
var _ = require('./lib/vendor/underscore.js')._;
var config = require('../config.js').config;//having some trouble with .gitignore here
var webfinger = require('./lib/webfinger.js').webfinger;
var storage = require('./lib/express-storage.js').storage;

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', {layout: false});
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use('/', express.errorHandler({ dump: true, stack: true }));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express Storage'
  });
});

app.get('/.well-known/host-meta', function(req, res){
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Content-Type', 'application/xrd+xml');
  res.send(webfinger.genHostMeta('http://'+config.host));
});

app.get(/^\/webfinger\/acct:(?:(.+))/, function(req, res){
  var userId = req.params[0];
  config.api = 'simple';
  config.authUrl = 'http://'+config.host+'/_oauth/'+userId;
  config.template = 'http://'+config.host+'/'+userId+'/{category}/';

  res.header('Access-Control-Allow-Origin', '*')
  res.header('Content-Type', 'application/xrd+xml');
  res.send(webfinger.genWebfinger(config.api, config.authUrl, config.template));
});

app.get('/_oauth/:user', function(req, res){
  var paramsObj ={
    userAddress: req.params.user.toLowerCase(),
    redirectUri: req.param('redirect_uri'),
    scope: req.param('scope').toLowerCase()
  };
  //remember no real input validation can be done here yet, because this will construct a form that still goes to the client-side:
  if(paramsObj.userAddress && paramsObj.redirectUri && paramsObj.scope && /^([a-z0-9_\.\-])+\@(([a-z0-9\-])+\.)+([a-z0-9]{2,4})+$/.test(paramsObj.userAddress)){
    res.render('oauth', paramsObj);
  } else {
    //this error message is purely informational:
    res.render('paramsError');
  }
});

app.post('/', function(req, res){
  //remember all actual input validation is done inside the createToken function:
  storage.getTokens({
    assertion: req.param('assertion'),
  }, function(err, tokens) {
    if(err) {
      res.send("No, bro.", 401);
    } else {
      res.render('tokens', {
        tokens:JSON.stringify(tokens)
      });
    }
  });
});
app.post(/^\/_oauth\/(?:(.+))/, function(req, res){
  //remember all actual input validation is done inside lib/express-storage:
  storage.getToken({
    userAddress: req.param('userAddress'),
    assertion: req.param('assertion'),
    scope: req.param('scope'),
    redirectUri: req.param('redirectUri')
  }, function(err, uri) {
    if(err) {
      res.send("No, bro.", 401);
    } else {
      console.log(uri);
      res.redirect(uri);
    }
  });
});

app.get("/create_test_user", function(req, res){
  storage.addUser('jimmy@'+config.host, '12345678', function(){});
  res.send("User created");
});

app.options('*', function(req, res){
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization');
  res.end();
});

app.all('/:user/:category/:key', function(req, res){
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization');

  try {
    auth_header = req.header('authorization', 'Bearer ');

    reqObj = {
      method: req.method,
      token: auth_header.substring('Bearer '.length),
      userId: req.params.user,
      category: req.params.category,
      key: req.params.key,
      value: ''
    };

    if (req.method == "PUT") {
      req.on('data', function(chunk) {
        reqObj.value += chunk;
      });
      req.on('end', function() {
        console.log(reqObj);

        storage.doReq(reqObj, function(status_code, data) {
          res.send(data, status_code);
        });
      });
    }
    else {
      console.log(reqObj);

      storage.doReq(reqObj, function(status_code, data) {
        res.send(data, status_code);
      });
    }
  }
  catch (e) {
    res.send(e, 500);
    console.log(e);
  }
});

if (!module.parent) {
  app.listen(config.port);
  console.log("Express server listening on port %d", config.port);
  // console.log("Config:");
  // console.log(util.inspect(config));
}

// REPL
if (process.argv[2] == "repl") {
  var repl = require("repl");
  var context = repl.start("$ ").context;
  context.util = require('util');
  context.config = require('./config.js').config;
  context.storage = require('./lib/express-storage.js').storage;
}
