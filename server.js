const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js');
const messageBlockSize = 10;
const crypto = require('crypto');



function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

//global variables
//mongodb stuff
var mongoURL = 'mongodb://localhost:27017';
var dbName = 'cpen400a-messenger';
var db = Database(mongoURL,dbName);

//login stuff
var sessionManager = new SessionManager();

//init messages
var messages = {};
db.getRooms()
	.then((result) => {
		for(let room of result){
			messages[room['_id']] = [];
		}
	})
	.catch((err) => {console.error(`Couldn't get rooms from mongodb during init: ${err}`)});


//returns chat rooms
app.route('/chat')
	.get((req, res) => {
		db.getRooms()
			.then((result) => {
				let rooms = [];
				for(let room of result){
					var roomCopy = Object.assign({}, room)
					roomCopy['messages'] = messages[room._id];
					rooms.push(roomCopy);
				}
				res.json(rooms); //send json response
			})
			.catch((err) => {throw new Error(`Can't get rooms from db: ${err}`)});
	});
//create a new chatroom
app.route('/chat')
	.post((req, res) => {
		var newRoomData = req.body;
		if(newRoomData['name'] == undefined){
			res.sendStatus(400);
		}else{
			db.addRoom(newRoomData)
				.then((result) =>{
					messages[result["_id"]] = [];
					res.json(result);
				})
				.catch((err) => {throw new Error(`Couldn't add room: ${err}`)});
		}
	});

//get a specific chatroom
app.route('/chat/:room_id').get((req,res) => {
	db.getRoom(req.params['room_id'])
		.then((result)=>{
			if(result == null){
				res.status(404).send(`Room ${req['room_id']} was not found`);
			}else{
				res.json(result);
			}
		})
		.catch((err) => {throw new Error(`Something went wrong trying to get the room: ${err}`)});
});

//get messages of a room
app.route('/chat/:room_id/messages').get((req, res) => {
	db.getLastConversation(req.params['room_id'], req.query['before'])
		.then((result) => {
			res.json(result);
		})
		.catch((err) => {throw new Error(`Something went wrong trying to get Room ${req.params['room_id']}'s messages: ${err}`)});
});

//login
app.route('/login')
	.post((req,res) => {
		db.getUser(req.body['username'])
		.then((result) => {
			if(result != null && isCorrectPassword(req.body['password'], result['password'])){
				sessionManager.createSession(res, req.body['username']);
				res.redirect(301, "/");
			}else{
				res.redirect(301, '/login');
			}
		})
		.catch((err) => {throw new Error(`Something went wrong with login` + err)});
	});

function isCorrectPassword(password, saltedHash){
	salt = saltedHash.substring(0,20);
	hash = crypto.createHash('sha256').update(password + salt).digest('base64');

	return saltedHash.substring(20) == hash;
}

//message broker
var clients = [];
var broker = new WebSocket.Server({port: 8000});

broker.on('connection', function connection(ws){
	clients.push(ws);
	ws.on('message', function incoming(message){
		var parsedMessage = JSON.parse(message);
		if(messages[parsedMessage.roomId] == undefined){
			messages[parsedMessage.roomId] = [];
			messages[parsedMessage.roomId].push(parsedMessage);
		}else{
			messages[parsedMessage.roomId].push(parsedMessage);
			//send messages to db if hit messageBlocksize
			if(messages[parsedMessage.roomId].length >= messageBlockSize){
				db.addConversation({
					"room_id" : parsedMessage.roomId,
					"timestamp" : Date.now(),
					"messages" : messages[parsedMessage.roomId]
				})
				messages[parsedMessage.roomId] = [];
			}
		}
		for(var client of clients){
			if(client != ws){
				client.send(message);
			}
		}
	});
});