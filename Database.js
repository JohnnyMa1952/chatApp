const { MongoClient, ObjectID } = require('mongodb');	// require the mongodb driver
/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen400a app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
				resolve(db.collection('chatrooms').find().toArray().catch(reject));
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			//return type objectId first (due to short circuit)
			try{
				var room_id_ObjectID = ObjectID(room_id);
			}catch(err){
				var room_id_ObjectID = undefined;
			}
			resolve(db.collection('chatrooms').findOne({$or:
				[
					{$and:
						[
							{"_id":room_id_ObjectID},
							{"_id":{$type:"objectId"}}
						]
					},
					{"_id":room_id}
				]
			}).catch(reject));
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			if(room['name'] == undefined || room['name'].trim() == ''){
				reject(new Error('Tried to insert room with no name'));
			}else{
			//if _id isn't specified, mongodb gives it a ObjectId automatically
				db.collection('chatrooms').insertOne(room,(error,result)=>{
					if(error){
						reject(error);
					}else{
						resolve(result.ops[0]);
					}
				});
			}
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if(before == undefined){ //set timestamp to now if not given
				before = Date.now();
			}else{
				before = parseInt(before);
			}

			try{ //see if we can convert room_id to type ObjectID
				room_id = ObjectID(room_id);
			}catch(err){
			}

			resolve(db.collection('conversations').find({
				$and:[
					{"room_id":room_id},
					{"timestamp":{$lt:before}}
				]
			}).sort({"timestamp":-1}).next()).catch(reject);
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if(conversation['room_id'] == undefined || conversation['timestamp'] == undefined || conversation['messages'] == undefined){
				reject(new Error('conversation is missing a required field'));
			}else{
				db.collection('conversations').insertOne(conversation, (error,result)=>{
					if(error){
						reject(error);
					}else{
						resolve(result.ops[0]);
					}
				});
			}
		})
	)
}

Database.prototype.getUser = function(username){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			resolve(db.collection('users').findOne({"username":username}).catch(reject));
		})
	)
}

module.exports = Database;