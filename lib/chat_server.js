var socketio = require('socket.io');

var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function (server) {

	// Starts the socket.io server, allowing it to piggyback onto
	// an existing HTTP server.
	io = socketio.listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {

		// Assign user initial guest name when they connect.
		guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

		// Place user in lobby when they connect.
		joinRoom(socket, 'Lobby');

		// Handle user messages, name-change attempts, and room creation/changes.
		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);

		// Provide user with list of occupied rooms on request.
		socket.on('rooms', function () {
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
	
	// Let user know they're in new room.
	socket.emit('joinResult', {
		room: room
	});
	
	// Let everyone know a new user has joined.
	socket.broadcast.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});

	// Find other users in room and print who they are.
	var usersInRoom = io.sockets.clients(room);
	if (usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ': ';
		for (var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if (userSocketId != socket.id) {
				if (index > 0) {
					usersInRoomSummary += ', ';
				}
				usersInRoomSummary += nickNames[userSocketId];
			}
		}
		usersInRoomSummary += '.';
		
		// Send summary of other users to new user.
		socket.emit('message', {
			text: usersInRoomSummary
		});
	}
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	
	// Add listener for name change attempt.
	socket.on('nameAttempt', function (name) {
		
		// Do not allow nicknames to begin with 'Guest'
		if (name.indexOf('Guest') == 0) {
			socket.emit('nameResult', {
				success: false,
				message: 'Names cannot begin with "Guest".'
			});
		} else {
			
			// If name is not already used, register it.
			if (namesUsed.indexOf(name) == -1) {
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;
				
				// Delete old name.
				delete namesUsed[previousNameIndex];
				socket.emit('nameResult', {
					success: true,
					name: name
				});
				socket.broadcast.to(currentRoom[socket.id]).emit('message', {
					text: previousName + ' is now known as ' + name + '.'
				});
			} else {
				
				// Emit error if name already in use.
				socket.emit('nameResult', {
					success: false,
					message: 'That name is already in use.'
				});
			}
		}
	});
}

function handleMessageBroadcasting(socket) {
	socket.on('message', function (message) {
		socket.broadcast.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}

function handleRoomJoining(socket) {
	socket.on('join', function (room) {
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	});
}

function handleClientDisconnection(socket) {
	socket.on('disconnect', function () {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	});
}