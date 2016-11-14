//in general, got a lot of help from the sites
//http://stackoverflow.com/questions/35680565/sending-message-to-specific-client-in-socket-io
// and
//http://psitsmike.com/2011/10/node-js-and-socket-io-multiroom-chat-tutorial/
//Don't wanna point out every place that i used them, mostly used general ideas


var http = require("http");
var path = require('path');
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
//detected words in 'pranks' will change to corresponding words in 'toChange'
var pranks = ['president', 'lol', 'vihar', 'trump', 'god'];
var toChange = ['supreme leader', 'i hate you', 'w-har', 'drumpf', 'harambe'];


var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	//when a user enters
	socket.on('adduser', function(username){
		//if user clicks 'cancel' on prompt, will redo
		var redo = false;
		for(key in users){
			//can't be multiple users with same name
			if(username == key){
				redo = true;
				socket.emit('redoUser');
			}
		}
		if(redo == false){
			//otherwise add user and commit appropriate messages
			//got this part from http://psitsmike.com/2011/10/node-js-and-socket-io-multiroom-chat-tutorial/
		socket.username = username;
		socket.room = 'default';
		users[username] = 'default';
		socket.join('default');
		socket.emit('updateChat', 'SERVER', 'you are connected to the default room');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', username+" has connected");
		socket.emit('updateRooms', rooms, 'default');
		io.sockets.emit('updateUsers', users, socket.username);
		io.sockets.emit('allPasswords', passwords);
		}
	});

	//for changing rooms
	socket.on('switchRoom', function(newRoom, user){
		
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
		
	});

	//when a room is created
	socket.on('create_room', function(newroom, creator, password){
		//given a password (check for no password elsewhere)
		passwords[newroom] = password;
		//stores creator of room, creator can kick, ban, and change creator
		rooms[newroom] = creator;
		socket.emit('updateChat', 'SERVER', 'new room created');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', 'new room created');
		io.sockets.emit('createdroom', rooms);
		io.sockets.emit('allPasswords', passwords);
	});

	//displays message, finds keywords from 'prank' array and changes 
	//instances of those words to other, predetermined words
	socket.on('message_to_server', function(data) {
		var res = data.split(" ");
		var result = "";
		console.log(res);

		for(var i=0; i<pranks.length; i++){
			for(var j=0; j<res.length; j++){
				if(res[j] == pranks[i]){
					res[j] = toChange[i];
				}
			}
		}
		for(var a=0; a<res.length; a++){
			result += res[a]+" ";
		}
		console.log(result);
		socket.room = users[socket.username];
		io.sockets.in(socket.room).emit("updateChat", socket.username, result);
	});

	//same as right above but as direct messages
	socket.on('direct_message', function(msg, target_user, user){
		var res = msg.split(" ");
		var result = "";
		console.log(res);

		for(var i=0; i<pranks.length; i++){
			for(var j=0; j<res.length; j++){
				if(res[j] == pranks[i]){
					res[j] = toChange[i];
				}
			}
		}
		for(var a=0; a<res.length; a++){
			result += res[a]+" ";
		}
		io.sockets.emit('dm_client', target_user, user, result);
	});

	// to kick a user, has to bounce back to client
	socket.on('kick_setup', function(target_user, given_room){
		// console.log(target_user+" kicked");
		if(given_room == 'default'){}
		else if(given_room == users[target_user]){
			io.sockets.emit('kicking', target_user);
		}	
	});

	//kick the user who was intended to be kicked, move to default room
	socket.on('kick', function(user){
		socket.broadcast.to(users[user]).emit('updateChat', 'SERVER', user+' has been kicked');
		socket.leave(socket.room);
		users[user] = 'default';
		socket.join('default');
		socket.emit('updateChat', 'SERVER', 'You have been kicked to the default room');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', user+' has joined this room');
		socket.emit('updateRooms', rooms, users[user]);
		io.sockets.emit('updateUsers', users, socket.username);
		socket.emit('clearChat', 'default');
	});

	//bounce back to the banned user's client
	socket.on('ban_setup', function(target_user, given_room){
		console.log('given room: '+given_room);
		console.log('room target is in: '+users[target_user]);
		if(given_room == 'default'){}
		else if(users[target_user] == given_room){
			io.sockets.emit('banning', target_user, given_room);
		}
		else{}
	});

	//transfer ownership of a room for kicking/banning privileges
	socket.on('transfer_admin', function(target_user, cur_user){
		if(users[target_user] == users[cur_user]){
			var r = users[target_user];
			rooms[r] = target_user;
			io.sockets.emit('updateRooms', rooms, r);
			socket.emit('updateChat', 'SERVER', 'You no longer own this room');
			socket.broadcast.to(r).emit('updateChat', 'SERVER', target_user+' now owns this room');
		}
	});

	//ban gets sent here, moves them from room
	socket.on('complete_ban', function(given_user){
		socket.broadcast.to(users[given_user]).emit('updateChat', 'SERVER', given_user+ ' has been BANNED');
		socket.leave(users[given_user]);
		users[given_user] = 'default';
		socket.join('default');
		socket.broadcast.to('default').emit('updateChat', 'SERVER', given_user+' has joined');
		socket.emit('updateChat', 'SERVER', 'You have been banned from this room');

		socket.emit('clearChat', 'default');
		socket.emit('updateRooms', rooms, users[given_user]);
		io.sockets.emit('updateUsers', users, given_user);
	});


	//to display when a user is typing
	socket.on('key_down', function(user){
		socket.broadcast.to(users[user]).emit('isTyping', user);
	});
	socket.on('key_off', function(user){
		socket.broadcast.to(users[user]).emit('stopTyping');
	});

});

