require('dotenv').config()
import { MongoClient } from 'mongodb';
import { setlog } from './helper';
const dbname = process.env.DB_NAME || 'dice'
const client = new MongoClient('mongodb://localhost:27017');
const db = client.db(dbname);
export const Users = 	db.collection<SchemaUsers>('users');
export const Rounds = 	db.collection<SchemaRounds>('rounds');

const connect = async () => {
	try {
		await client.connect()
		setlog('connected to MongoDB')
		Users.createIndex( {userId: 1}, { unique: true })
		Users.createIndex( {id: 1}, { unique: true })

	} catch (error) {
		console.error('Connection to MongoDB failed', error)
		process.exit()
	}
}

export default { connect };