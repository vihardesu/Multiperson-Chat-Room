var http = require("http");
var	socketio = require("socket.io");
var	fs = require("fs");

var app = http.createServer(function(req, resp){
	fs.readFile("client.html", function(err, data){
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

var users = {};
var rooms = {'default':''};
var bans = [];
var passwords = {};

var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	socket.on('adduser', function(username){
		socket.username = username;
		socket.room = 'default';
		users[username] = 'default';
		socket.join('default');
		socket.emit('updateChat', 'SERVER', 'you are connected to the default room');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', username+" has connected");
		socket.emit('updateRooms', rooms, 'default');
		io.sockets.emit('updateUsers', users, socket.username);
		console.log(users);

	});
	socket.on('switchRoom', function(newRoom, user){
		
		var canSwitch = true;
		for(var i=0; i<bans.length; i++){
			console.log(Object.keys(bans[i]));
			console.log(bans[i]);
			if(newRoom == Object.keys(bans[i]) && user == bans[i].newRoom){
				canSwitch = false;
			}
		}
		if(canSwitch == true){
		//leave current room in session
		socket.username = user;
		users[user] = newRoom;
		socket.leave(socket.room);
		socket.join(newRoom);
		socket.emit('updateChat', 'SERVER', 'connected to '+newRoom);
		socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', socket.username+' has left');
		io.sockets.in(newRoom).emit('updateChat', 'SERVER', socket.username + ' has joined this room');
		socket.room = newRoom;
		socket.emit('updateRooms', rooms, newRoom);	
		io.sockets.emit('updateUsers', users, socket.username);
		socket.emit('clearChat', newRoom);
		}
	});

	socket.on('create_room', function(newroom, creator, password){
		passwords[newroom] = password;
		rooms[newroom] = creator;
		socket.emit('updateChat', 'SERVER', 'new room created');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', 'new room created');
		io.sockets.emit('createdroom', rooms);
		io.sockets.emit('allPasswords', passwords);
	});

	socket.on('message_to_server', function(data) {
		console.log("message: "+data["message"]);
		console.log(users[socket.username]);
		socket.room = users[socket.username];
		io.sockets.in(socket.room).emit("updateChat", socket.username, data['message']);
	});

	socket.on('direct_message', function(msg, target_user, user){
		console.log("dm: "+msg);
		io.sockets.emit('dm_client', target_user, user, msg);
	});

	socket.on('kick_setup', function(target_user, given_room){
		console.log(target_user+" kicked");
		if(given_room == 'default'){

		}
		else if(given_room == users[target_user]){
			io.sockets.emit('kicking', target_user);
		}	
	});

	socket.on('kick', function(user){
		socket.broadcast.to(users[user]).emit('updateChat', 'SERVER', user+' has been kicked');
		socket.leave(socket.room);
		users[user] = 'default';
		socket.join('default');
		socket.emit('updateChat', 'SERVER', 'You have been kicked to the default room');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', user+' has joined this room');
		socket.emit('updateRooms', rooms, users[user]);
		io.sockets.emit('updateUsers', users, socket.username);
		console.log(users);
		socket.emit('clearChat', 'default');
	});

	socket.on('ban_setup', function(target_user, given_room){
		if(given_room == 'default'){

		}
		else if(given_room == users[target_user]){
			io.sockets.emit('banning', target_user, given_room);
		}
	});

	socket.on('ban', function(user, given_room){
		console.log(bans);
		var key = given_room;
		var obj = {};
		obj[key] = user;
		bans.push(obj);	
		console.log(bans);
		io.sockets.emit('updateBans', bans);
		socket.broadcast.to(users[user]).emit('updateChat', 'SERVER', user+' has been banned from this room');
		socket.leave(socket.room);
		users[user] = 'default';
		socket.join(users[user]);
		socket.emit('updateChat', 'SERVER', 'You have been banned from this room');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', user+' has joined');
		socket.emit('updateRooms', rooms, users[user]);
		io.sockets.emit('updateUsers', users, socket.username);

	});

});

