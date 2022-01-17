//profile
var profile = {username:"Johnny"};
//Service
var Service = {origin: "http://localhost:3000",
							getAllRooms: function(){
								return fetch(this.origin + '/chat')
								.then(
									(response) => {
										if(response.status === 200){
											return Promise.resolve(response.json());
										} else {
											return response.text().then((text) => {
												throw new Error(text);
											});
										}
									}
								)
								.catch(
									(err) => {
										console.log(err);
										return Promise.reject(err);}
								);
							},
							addRoom: function(data){
								return fetch(this.origin + '/chat',{
									method: 'post',
									headers: {
										"Content-type": "application/json"
									},
									body: JSON.stringify(data)
								})
								.then((response) => {
									if(response.status === 200){
										return response.json();
									}else{
										return response.text().then((text) => {
											throw new Error(text);
										});
									}
								});
							},
							getLastConversation: function(roomId, before){
								let url = this.origin + `/chat/` + roomId.toString() + `/messages`;
								if(before != undefined){
									url = url + `?before=` + before;
								}
								return fetch(url)
									.then(
										(response) => {
											if(response.status === 200){
												return Promise.resolve(response.json());
											}else{
												return response.text().then((text) =>{
													throw new Error(text);
												});
											}
										}
									)
									.catch(
										(err) => {
											console.log(err);
											return Promise.reject(err);
										}
									);
							}
};
//classes
var LobbyView = function(lobby){
	this.lobby = lobby;
	this.elem = renderLobby();
	this.listElem = this.elem.getElementsByClassName("room-list")[0];
	this.inputElem = this.elem.querySelector("#room-input");
	this.buttonElem = this.elem.querySelector("#create-room-button");
	var self = this;
	this.redrawList();

	this.lobby.onNewRoom = function(room){
		self.listElem.appendChild(self.createRoomElem(room))
	}

	function click() {
		var input = String(self.inputElem.value).trim();
		if(input == undefined || input == "")
			return;
		
		Service.addRoom({'name': input, 'image': undefined})
		.then((result) =>{
			self.lobby.addRoom(result['_id'], result['name'], result['image'], result['messages']);
		}).catch((err)=>{console.log(err)})

		self.inputElem.value = ""; //clear the textbox
	}

	this.buttonElem.addEventListener("click", click);


}

LobbyView.prototype.redrawList = function(){
	emptyDOM(this.listElem);
	for(var roomid in this.lobby.rooms){
		this.listElem.appendChild(this.createRoomElem(this.lobby.rooms[roomid]));
	}
}

LobbyView.prototype.createRoomElem = function(room){
	htmlString =`<li><a href='#/chat/` + String(room.id) + `'><img src="` + room.image  +  `"><p>` + room.name + `</p></a></li>`;
	return createDOM(htmlString)
}


var ChatView = function(socket){
	var self = this;
	this.socket = socket;
	this.elem = renderChat();
	this.room = null;
	this.titleElem = this.elem.getElementsByTagName("h4")[0];
	this.chatElem = this.elem.getElementsByClassName("message-list")[0];
	this.inputElem = this.elem.querySelector("#chat-textarea");
	this.buttonElem = this.elem.querySelector("#chat-send");

	function click(){
		self.sendMessage();
	}

	function keyup(e){
		if(e.keyCode === 13 && e.shiftKey == false){
			self.sendMessage();
		}
	}

	this.buttonElem.addEventListener("click", click);
	this.inputElem.addEventListener("keyup",keyup);
}

ChatView.prototype.clearChat = function(){
	emptyDOM(this.chatElem);
}

ChatView.prototype.sendMessage = function(){
	var messageText = this.inputElem.value;
	this.room.addMessage(profile.username,messageText);
	this.inputElem.value = "";
	this.socket.send(JSON.stringify({roomId:this.room.id, username:profile.username, text:messageText}));
}

ChatView.prototype.setRoom = function(room){
	this.room = room;
	var self = this;
	this.room.onNewMessage = function(message){
		if(message['roomId'] == self.room.id){
			self.chatElem.appendChild(self.createMessageElem(message));
		}
	}
	this.titleElem.innerText = room.name;
	emptyDOM(this.chatElem);
	for(elem of this.room.messages){
		this.chatElem.appendChild(this.createMessageElem(elem));
	}
}

ChatView.prototype.createMessageElem = function(message){
	isMyMessage = message["username"] == profile.username ? ` my-message` : ``
	htmlString = `<div class="message` + isMyMessage + `">
	<span class="message-user">` + message["username"] + `</span>
	<span class="message-text">` + message["text"] + `</span>
	</div>`;
	return createDOM(htmlString);
}

var ProfileView = function(){
	this.elem = renderProfile();
}

var Room = function(id, name, image="assets/everyone-icon.png", messages=[]){
	this.id = id;
	this.name = name;
	this.image = image;
	this.messages = messages;
}

Room.prototype.addMessage = function (username, text){
	if(text == null || text == undefined || text.trim() == "")
		return;
	newMessage = {"roomId": this.id,"username": username, "text": text}
	this.messages.push(newMessage);
	
	if(this.onNewMessage != undefined)
		this.onNewMessage(newMessage);
}

var Lobby = function(){
	this.rooms = [];
}

Lobby.prototype.getRoom = function(roomID){
	if(roomID in this.rooms)
		return this.rooms[roomID];
	else
		throw "no such room";
}

Lobby.prototype.addRoom = function(id, name, image, messages){
	var room = new Room(id, name, image, messages);
	this.rooms[room.id] = room;
	if(this.onNewRoom != undefined)
		this.onNewRoom(room);
}


// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem){
	while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
	let template = document.createElement('template');
	template.innerHTML = htmlString.trim();
	return template.content.firstChild;
}


function renderLobby(){
	var content = createDOM(`<div class="content"> </div>`);
	var roomList = createDOM(`<ul class="room-list"></ul>`);
	var pageControl = createDOM(`<div class="page-control"></div>`);
	var roomInput = createDOM(`<input type="text" id="room-input" />`);
	var createRoom = createDOM(`<button id="create-room-button">Create Room</button>`);
	content.appendChild(roomList);
	content.appendChild(pageControl);
	pageControl.appendChild(roomInput);
	pageControl.appendChild(createRoom);

	console.log("render lobby pageView complete");

	return content;
}

function renderChat(){
	var content = createDOM(`<div class="content"> </div>`);
	var roomName = createDOM(`<h4 class="room-name">TEMP_ROOM_NAME</h4>`);
	var messageList = createDOM(`<div class="message-list"></div>`);
	var pageControl = createDOM(`<div class="page-control"></div>`);
	var chatTextArea = createDOM(`<textarea id="chat-textarea"></textarea>`);
	var chatSend = createDOM(`<button id="chat-send">Send</button>`);

	content.appendChild(roomName);
	content.appendChild(messageList);
	content.appendChild(pageControl);
	pageControl.appendChild(chatTextArea);
	pageControl.appendChild(chatSend);
	console.log("render chat pageView complete");

	return content;
}

function renderProfile(){
	//helper function for input fields
	function createFormFieldInput(label, id, type){
		let htmlString = `<div class="form-field"><label>` + label + `</label><input type="` + type + `" ` + `id="` + id + `" ` + `/></div>`;
		return createDOM(htmlString);
	}

	var content = createDOM(`<div class="content"> </div>`);
	var profileForm = createDOM(`<div class="profile-form"></div>`)
	var pageControl = createDOM(`<div class="page-control"></div>`);
	var save = createDOM(`<button id="save">Save</button>`)
	var aboutTextArea = createDOM(`<div class="form-field"><label>About</label><textarea></textarea></div>`)
	
	content.appendChild(profileForm);
	profileForm.appendChild(createFormFieldInput("Username", "username", "text"));
	profileForm.appendChild(createFormFieldInput("Password", "password", "text"));
	profileForm.appendChild(createFormFieldInput("Avatar Image", "avatar", "file"));
	profileForm.appendChild(aboutTextArea);

	content.appendChild(pageControl);
	pageControl.appendChild(save);
	console.log("render profile pageView complete");

	return content;
}

//main function gets run after windows.onLoad
var main = function(){
	var socket = new WebSocket('ws://' + window.location.hostname + ':8000')
	socket.addEventListener('message', (event) =>{
		var newMessage = JSON.parse(event.data);
		try{
			var room = lobby.getRoom(newMessage['roomId']);
			room.addMessage(newMessage['username'],newMessage['text']);
		}catch(err){
			//TODO -------------------------- IF we don't have that room, don't do anything for now.
		}
	})

	var lobby = new Lobby();
	var lobbyView = new LobbyView(lobby);
	var chatView = new ChatView(socket);
	var profileView = new ProfileView();

	function renderRoute() {
		var loc = window.location.hash;
		var pageView = document.getElementById(`page-view`);
		emptyDOM(pageView)
		if(loc == '#' || loc == '#/' || loc == ''){
			pageView.appendChild(lobbyView.elem);
		}else if(loc.includes('#/chat')){
			chatView.clearChat();
			pageView.appendChild(chatView.elem);
			let urlArr = loc.split(/\//)
			try{
				destRoom = lobby.getRoom(urlArr[2]);
				chatView.setRoom(destRoom);
			}catch(e){
				console.log("Exception:" + e);
				emptyDOM(pageView);
				pageView.appendChild(lobbyView.elem); //go back to main page
			}
		}else if(loc == '#/profile'){
			pageView.appendChild(profileView.elem);
		}else{
			console.log("Error, unknown page " + loc);

		}
	}

	function refreshLobby(){
		Service.getAllRooms().then((result) => {
			for(let room of result){
				try{
					let oldRoom = lobby.getRoom(room._id);
					oldRoom.name = room.name;
					oldRoom.image = room.image;
				}catch(err){ //getRoom throws err if no room; add room if no room
					lobby.addRoom(room._id, room.name, room.image, room.messages)
				}
			}
		})
		.catch((err) => {console.log(err)});
	}

	//main function statements
	window.addEventListener('popstate', renderRoute); //view switching
	renderRoute();

	refreshLobby(); //refresh rooms in lobby
	window.setInterval(refreshLobby,5000);

	//testing code
  	cpen400a.export(arguments.callee, {
  		refreshLobby: refreshLobby,
  		lobby: lobby,
  		socket: socket,
  		chatView:chatView
  });

}

window.addEventListener('load', main)