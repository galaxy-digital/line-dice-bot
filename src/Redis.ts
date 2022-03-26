import { SessionType } from "./@types/portal";
import { setlog } from "./helper";

const Redis = require('ioredis');
const redis = new Redis({ host: 'localhost', port: 6379 });
 
redis.on('connect', ()=>{
	setlog("connected to Redis server")
});
   
export const getSession = async (key:string):Promise<SessionType|null>=>{
	try {
		  const buf = await redis.get(key)
		if (buf) return JSON.parse(buf) as SessionType
	} catch (error) {
		setlog('getSession', error)
	}
	return null
}

export const setSession = async (key:string, value:SessionType)=>{
	try {
		await redis.set(key, JSON.stringify(value))
	} catch (error) {
		setlog('setSession', error)
	}
}