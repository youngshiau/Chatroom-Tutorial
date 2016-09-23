var socketio = require('socket.io');

var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function(server) {
	
	// Starts the socket.io server, allowing it to piggyback onto
	// an existing HTTP server.
	io = socketio.listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function(socket) {
		
		// Assign user initial guest name when they connect.
		guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
		
		// Place user in lobby when they connect.
		joinRoom(socket, 'Lobby');
		
		// Handle user messages, name-change attempts, and room creation/changes.
		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);
		
		// Provide user with list of occupied rooms on request.
		socket.on('rooms', function() {
			socket.emit('rooms', io.sockets.manager.rooms);
		});
		
		// Defines clean-up logic for when user disconnects.
		handleClientDisconnection(socket, nickNames, namesUsed);
	});
};


function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
	
	// Generate new guest name.
	var name = 'Guest' + guestNumber;
	
	// Associate guest name with client connection id.
	nickNames[socket.id] = name;
	
	// Let user know their guest name.
	socket.emit('nameResult', {
		success: true,
		name: name
	});
	
	// Mark guest name as used and increment counter to generate guest names.
	namesUsed.push(name);
	return guestNumber + 1;
}

function joinRoom(socket, room) {
	socket.join(room);
	currentRoom[socket.id] = room;
	socket.emit('joinResult', { room: room });
	socket.broadcast.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});
	
	var usersInRoom = io.sockets.clients(room);
	if(usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ': ';
		for(var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if(userSocketId != socket.id) {
				if(index > 0) {
					usersInRoomSummary += ', ';
				}
				usersInRoomSummary += nickNames[userSocketId];
			}
		}
		usersInRoomSummary += '.';
		socket.emit('message', { text: usersInRoomSummary });
	}
}