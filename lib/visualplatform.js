/*

var visualplatform = Visualplatform(domain);
visualplatform.album.list({search:'test'})
  .then(
    function(data){...},
    function(errorMessage){...}
  );

var visualplatform = Visualplatform(domain, key, secret);
visualplatform.album.create({title:'New album'}, access_token. access_token_secret)
  .then(
    function(data){...},
    function(errorMessage){...}
  );

Methods can be called as:
  visualplatform.photo.updateUploadToken(...)
  visualplatform['photo.updateUploadToken'](...)
  visualplatform['/api/photo/update-upload-token'](...)

The first parameter is always a JS object with the filter data  described in
http://www.23developer.com/api/#methods

All methods requiring authentication takes access_token and access_secret
as their second and third parameters.

*/

var OAuthAuthentication = require('./authentication');
var Promise = require("promise");
var oauth = require('./oauth');
var url = require('url');
var querystring = require('querystring');

module.exports = Visualplatform = function(domain, key, secret, callback_url){
  var $ = this;
  var rest = require('restler');
  $.serviceDomain = domain;
  $.consumer_key = key;
  $.consumer_secret = secret;
  $.callback_url = callback_url||'';

  /* API WEB SERVICE API */
  $.call = function(method, data, access_token, access_secret){
    // Handle arguments
    return new Promise(function(fulfill, reject) {
      data = data||{};
      data['format'] = 'json';
      data['raw'] = '1';
      access_token = access_token||'';
      access_secret = access_secret||'';

      var tryParse = function(data) {
        if (data.status == 'ok') {
	  return fulfill(data);
        } else {
	  data = JSON.parse(data);
        }

        // Status might not be ok, even though the request went through
        if (!data.status == 'OK' || !data.status == 'ok') {
          return reject(data.message);
        }
        else {
          if (method === '/api/concatenate') {
            var photos = [];
            for (item in data) {
              photos = photos.concat(data[item].photos);
              delete data[item];
            }
            data = {
              photos: photos,
              status: data.status
            };
          }

          return fulfill(data);
        }
      }
      var handleSuccess = function(res) {
        // Use try/catch to avoid malformed JSON-responses
        try {
          tryParse(res);
        }
        catch (e) {
          console.log('JSON parse error, will try fixing it', e);
          if (res[0] === '{' && res[res.length-1] === '}') {
            res = res.replace(/[a-z]+_[0-9]+:/g, '"$&":');
            try {
              tryParse(res);
            }
            catch (e) {
              return reject('Error parsing response');
            }
          }
          return reject('Error parsing response');
        }
      }
      var handleErr = function(res) {
        // Use try/catch to avoid malformed JSON-responses
        try {
          res = JSON.parse(res);
          // If response is object, parse and return err, if response is a number it's a timeout
          if (typeof res == Object) {
            return reject(res.message);
          } else if (!isNaN(res)) {
            return reject('Timeout: ' + res);
          } else {
            return reject(res);
          }
        }
        catch(e) {
          console.log('JSON parse error', e);
          return reject('Error parsing response');
        }
      }

      if (data.requestMethod == 'GET' && (!data.include_unpublished_p || data.include_unpublished_p == 0) && cached.indexOf(method) > -1) {
        // Remove request method from data, since it has no effect on api calls
        delete data.requestMethod;

        // Set up the request with callbacks
        rest.get(url.parse('https://'+$.serviceDomain+':443'+method+'?'+querystring.stringify(data)))
          .on('success', handleSuccess)
          .on('fail', handleErr)
          .on('error', handleErr)
          .on('timeout', handleErr);

      } else {
        // Set up the request with callbacks
        rest.post('https://'+$.serviceDomain+method, {
            data:data,
            headers: {
              Authorization: oauth.signature(url.parse('https://'+$.serviceDomain+':443'+method+'?'+querystring.stringify(data)), {
                oauthConsumerKey: $.consumer_key,
                oauthConsumerSecret: $.consumer_secret,
                oauthAccessToken: access_token,
                oauthAccessTokenSecret: access_secret,
                method: 'POST'
              })
            }
          })
          .on('success', handleSuccess)
          .on('fail', handleErr)
          .on('error', handleErr)
          .on('timeout', handleErr);
      }
    });
  }

  // Map entire Visualplatform API
  var methods = require('./endpoints');
  // Map cached endpoints for saving resources spent on api requests
  var cached = ['/api/album/list','/api/comment/list/','/api/license/list','/api/live/list','/api/photo/frame','/api/photo/list','/api/player/list','/api/player/settings','/api/photo/section/list','/api/site/get','/api/photo/subtitle/list','/api/tag/list','/api/tags/related'];

  // Build functions for each Visualplatform API method
  for (i in methods) {
    var method = methods[i];
    $[method] = (function(method){
        return function(data,access_token,access_secret){
          var data=data||{};
          var access_token=access_token||'';
          var access_secret=access_secret||'';
          return($.call(method, data, access_token, access_secret));
        }
      })(method);

    // Create sub-objects for the different API namespaces
    var camelizedMethod = method.replace(/-(.)/g, function(_,$1){return $1.toUpperCase()});
    var s = camelizedMethod.split('/').slice(2);
    var x = [];
    for (var i=0; i<s.length-1; i++) {
      x.push(s[i]);
      if(!$[x.join('.')]) $[x.join('.')] = {};
    }
    // Create an alias for the method (both $.album.list and $['album.list'])
    if(x.length>0) {
      $[x.join('.')][s[s.length-1]] = $[method];
    } else {
      $[s[s.length-1]] = $[method];
    }
    $[s.join('.')] = $[method];
  };


  /* OAUTH AUTHENTICATION HELPERS */
  $.oauth = OAuthAuthentication('api.visualplatform.net', $.consumer_key, $.consumer_secret, $.callback_url);
  $._oauthToken = '';
  $.beginAuthentication = function(){
    return new Promise(function(fulfill, reject) {
    	$.oauth.request_token().then(
    		function(response) {
	    		$._oauthToken = response.oauth_token;
	    		return fulfill('http://api.visualplatform.net/oauth/authorize?oauth_token=' + $._oauthToken);
    		},function(message) {
	    		return reject(message);
    		}
    	);
    });
  }
  $.completeAuthentication = function(token, verifier){
    return $.oauth.access_token(token||$._oauthToken, verifier);
  }


  return(this);
};

