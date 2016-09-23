var http	= require('http');	// Provides HTTP server and client functionality.
var fs		= require('fs');		// Provides filesystem related functionality.
var path	= require('path');	// Provides filesystem path-related functionality.
var mime	= require('mime');	// Provides ability to derive MIME type based on filename extension.

var chatServer = require('./lib/chat_server.js');

// Used to cache file data.
var cache = {};

// Creates the HTTP server.
// Anonymous function defines per-request behavior.
var server = http.createServer(function(request, response) {
	var filePath = false;

	// HTML file to be served by default.
	if(request.url == '/') {
		filePath = 'public/index.html';
	}
	
	// Translate URL path to relative file path.
	else {
		filePath = 'public' + request.url;
	}
	
	// Serve the static file.
	var absPath = './' + filePath;
	serveStatic(response, cache, absPath);
});

server.listen(3000, function() {
	console.log("Server listening on port 3000.");	
});

chatServer.listen(server);




// Helper functions.
function send404(response) {
	response.writeHead(
				404, 
				{'Content-Type': 'text/plain'});
		response.write('Error 404: resource not found.');
		response.end();
}

function sendFile(response, filePath, fileContents) {
		response.writeHead(
				200, 
				{'Content-Type': mime.lookup(path.basename(filePath))});
		response.end(fileContents);
}

function serveStatic(response, cache, absPath) {
		
		// Check if the file is cached in memory.
		if(cache[absPath]) {
				
				// If it is, serve file from memory.
				sendFile(response, absPath, cache[absPath]);
		}
		else {
				
				// If the file is not cached from in memory, check if the file exists.
				fs.exists(absPath, function(exists) {
						
					// If the file exists, read the file from disk. Otherwise, send HTTP 404 response.
					if(exists) {
							fs.readFile(absPath, function(err, data) {
									
									// Handle errors. If there are none, then store the file in memory
									// and serve the file that was read from disk.
									if(err) {
											send404(response);
									}
									else {
											cache[absPath] = data;
											sendFile(response, absPath, data);
									}
							});
					}
					else {
							send404(response);
					}
				});
		}
}