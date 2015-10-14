this.EXPORTED_SYMBOLS=["fetch"];

var {NetUtil} = Components.utils.import("resource://gre/modules/NetUtil.jsm");

function fetch(aURL, aOptions={
  loadFromCache: true,
  policy: Components.interfaces.nsIContentPolicy.TYPE_OTHER,
  charset: null
}) {
  return new Promise(function(resolve,reject) {
    try {
    // Attempt to create a channel.
    let channel;

    var iOService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);

    try {
      channel = NetUtil.newChannel({
        uri: aURL,
        contentPolicyType: aOptions.policy,
        loadUsingSystemPrincipal: true
      });
    } catch (e) {
      return reject(e);
    }

    // Set the options on the channel...
    //channel.loadFlags = aOptions.loadFromCache
    //  ? channel.LOAD_FROM_CACHE
    //  : channel.LOAD_BYPASS_CACHE;

    channel.loadFlags = channel.LOAD_FROM_CACHE;

    // set request body and request method
    if (aOptions.body) {
      try {
        channel.QueryInterface(Components.interfaces.nsIUploadChannel); 
        let inputStream = Components.classes['@mozilla.org/io/string-input-stream;1'].createInstance(Components.interfaces.nsIStringInputStream);
        inputStream.setData(aOptions.body, aOptions.body.length);
        channel.setUploadStream(inputStream,"application/json",-1);
      } catch (e) {
        reject(e);
      }
    }

    // we must set the method after the body since setting a body can clobber the value
    channel.QueryInterface(Components.interfaces.nsIHttpChannel);
    if (aOptions.method) {
      channel.requestMethod = aOptions.method;
    }

    // set headers
    if (aOptions.headers) {
      for (let header in aOptions.headers) {
        channel.setRequestHeader(header, aOptions.headers[header], false);
      }
    }

    let onResponse = (stream, status, request) => {
      let responseStatus = channel.responseStatus;

      if (responseStatus > 399 || responseStatus < 200) {
        reject(new Error(`Failed to fetch ${aURL}. Code ${responseStatus}.`));
        return;
      }

      let body = null;

      if (responseStatus < 299) {
        // Read and decode the data according to the locale default encoding.
        let available = stream.available();
        body = NetUtil.readInputStreamToString(stream, available);
        stream.close();
      }

      try {
        let headers = [];
        let httpHeaderVisitor = {
          visitHeader: function(aHeader, aValue) {
            // headers.get only returns the first header value - ensure only
            // the first is set
            if (!headers[aHeader]) {
              headers[aHeader.toLowerCase()] = aValue;
            }
          }
        };

        let headersObject = {
          headers: headers,
          get: function(aHeader) {
            return headers[aHeader.toLowerCase()];
          }
        };

        channel.visitResponseHeaders(httpHeaderVisitor);

        let responseObject = {
          status: channel.responseStatus,
          statusText: channel.responseStatusText,
          headers: headersObject
          //content: unicodeSource,
          //contentType: request.contentType
        };

        if (body) {
          responseObject.text =  function(){
            return new Promise(function(resolve, reject) {
              let charset = channel.contentCharset || aOptions.charset || "UTF-8";
              let conv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
              conv.charset = charset;
              let unicodeSource = conv.ConvertToUnicode(body);
              resolve(unicodeSource);
            });
          };
        } else {
          responseObject.text = function() {
            return new Promise(function(resolve, reject){
              resolve("");
            });
          };
        }
        resolve(responseObject);
      } catch (e) {
        reject(e);
      }
    };

    // ...and open it
    try {
      NetUtil.asyncFetch(channel, onResponse);
    } catch (e) {
      return promise.reject(e);
    }
    } catch (e) {
      return promise.reject(e);
    }
  });
}
