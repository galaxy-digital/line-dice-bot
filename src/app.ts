require("dotenv").config();

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as express from 'express';
import * as cors from 'cors'


import Api, {initApp} from './api'
import {setlog} from './helper';
import Model from './Model'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const port = Number(process.env.HTTP_PORT || 80)
const portHttps = Number(process.env.HTTPS_PORT || 443)

process.on("uncaughtException", (error) => setlog('exception', error));
process.on("unhandledRejection", (error) => setlog('rejection', error));

Date.now = () => Math.round((new Date().getTime()) / 1000);

Model.connect().then(async ()=>{
	try {
		await initApp();
		const app = express()
		const server = http.createServer(app)
		let httpsServer = null as any;
		const fileKey = __dirname+'/../certs/portal.api.key'
		const filePem = __dirname+'/../certs/portal.api.pem'
		if (fs.existsSync(fileKey) && fs.existsSync(filePem)) {
			const key = fs.readFileSync(fileKey, 'utf8')
			const cert = fs.readFileSync(filePem, 'utf8')
			const options = {cert,key}
			httpsServer = https.createServer(options,app)
		}

		app.use(cors({
			origin: function(origin, callback){
				return callback(null, true)
			}
		}))
		
		
		app.use(Api);
		
		app.use(express.urlencoded({limit: '200mb'}))
		app.use(express.json({limit: '200mb'}))

		app.get('*', (req,res) => {
			res.status(404).send('')
		})
		let time = +new Date()
		await new Promise(resolve=>server.listen({ port, host:'0.0.0.0' }, ()=>resolve(true)))
		setlog(`Started HTTP service on port ${port}. ${+new Date()-time}ms`)
		if (httpsServer) {
			time = +new Date()
			await new Promise(resolve=>httpsServer.listen({port:portHttps, host:'0.0.0.0'}, ()=>resolve(true)))
			setlog(`Started HTTPS service on port ${portHttps}. ${+new Date()-time}ms`)
		}
	} catch (error) {
		setlog("init", error)
		process.exit(1)
	}
})