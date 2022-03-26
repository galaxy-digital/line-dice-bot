require("dotenv").config()
import * as express from 'express'
import * as fs from 'fs'
import { setlog } from './helper'
import * as line from '@line/bot-sdk'
import { Message } from '@line/bot-sdk';
import { Groups, Rounds, Users } from './Model';
import { createCanvas, Image } from 'canvas'

const middleware = line.middleware;

const router = express.Router()

const now = () => Math.round(new Date().getTime()/1000)

const adminChatId = process.env.ADMIN_CHATID || ''
const channelAccessToken = process.env.CHANNEL_ACCESSTOKEN || ''
const channelSecret = process.env.CHANNEL_SECRET || ''
const serverUrl = process.env.SERVER_URL || ''

const config = { channelAccessToken,  channelSecret, };
const client = new line.Client({ channelAccessToken });
const isAdmin = (userId:string) => userId===adminChatId

const AdminCommands = {
	start: 			"/start",		// 管理命令 - 开始
	stop: 			"/stop",		// 管理命令 - 开始
	deposit: 		"/deposit",		// 管理命令 - 充值 
	statistic: 		"/total",	// 管理命令 - 统计	
}
const Commands = {
	cancel:			"/X",
	balance:		"/C",
	help:			"/A",
	stopBet:		"/B",
	rolling:		"/S",
	bankAccount:	"/Y",
	pastRounds:		"/N",

	methodSingle:	"/"
}

let currentRound = {
	roundId:		0,
	started:		false
}

const MSG_REGISTERED_BANK = 'Your bank account was successfully registered.'
const MSG_BALANCE = 'your balance is {balance}.'
const MSG_GAME_RULE = `1 single type:
Small: The total points are 4-10 (Leopard Banker takes all)
Big: 11-17 total points (Leopard Banker takes all)
Single: The total number of points is 5.7.9.11.13.15.17 points
Double: 4.6.8.10.12.14.16 points total
Multiple: 2 times
2. Duplex
Big single, big double, small single, small double, digital size, digital single and double.
Odds: 3.3x

3 double digits
1/2 3/1
Odds: 6x
4. Single Number
Offer a 2x odds
2 out of 3 odds
3 out of 4 odds
`
const MSG_NOT_STARTED = 'Betting has not yet started.'
const MSG_CANCEL_BET = 'your betting cancelled'
const MSG_CANCEL_BET_NOT_STARTED = 'you did not jointed betting.'
const MSG_DEPOSIT_SUCCESS = '{user} deposited successfully. '

const ERROR_REQUIRE_BANK = 'Command format: /Y {bank account}'
const ERROR_INVALID_PARAM = 'invalid parameter'
const ERROR_NOT_EXISTS_USER = 'not exist user'

const images = {} as {[key:string]:Image}

export const replyMessage = (replyToken:string, text:string) => {
	const message = {
		type: 'text',
		text: text
	} as Message;
	  
	client.replyMessage(replyToken, message).then((res) => {
		console.log(res)
	}).catch((err) => {
		console.log(err)
	});
}
export const replyDieImage = async (replyToken:string, text:string) => {
	const uri = await getDiceImage(text)
	const message = {
		type: 'image',
		originalContentUrl: serverUrl + '/' + uri,
		previewImageUrl: serverUrl + '/' + uri
	} as Message
	  
	client.replyMessage(replyToken, message).then((res) => {
		console.log(res)
	}).catch((err) => {
		console.log(err)
	});
}
const getImage = (src:string):Promise<Image|null> => {
	return new Promise(resolve=>{
		const buf = fs.readFileSync(src)
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = err => resolve(null)
		img.src = buf
	})
}

export const initApp = async () => {
	const _fileDir = __dirname + '/../assets'
	const files = fs.readdirSync( _fileDir)
	for (let i of files) {
		if (i.slice(-4)!=='.png') continue
		const image = await getImage( _fileDir + '/' + i)
		if (image) images[i.slice(0, -4)] = image
		// let uri = 'data:image/webp;base64,' + fs.readFileSync( _fileDir + '/captcha/' + i ).toString("base64");
	}
	const row = await Rounds.findOne({ result:{ $exists:false } })
	if (row!==null) {
		currentRound.roundId = row.roundId
		currentRound.started = row.started
	}
}

const hook = (req:express.Request, res:express.Response)=>{
	if (req.body.events && req.body.events.length!==0) {
		const event = req.body.events[0]
		const { message, source } = event
		handleWebHook(event, source, message)
	}
	res.status(200).send('');
}

router.post("/webhook", middleware(config), hook);

router.post("/webhook-test", (req:express.Request, res:express.Response)=>{
	const body = req.body
	res.status(200).send('');
})

const getDiceImage = async (text: string) => {
	if (text.length===3) {
		const w = 800
		const h = 600
		const diceSize = 128
		let left = 120
		let top = 370
		let spacing = (w - left * 2 - diceSize * 3) / 2
		const canvas = createCanvas(w, h)
		const context = canvas.getContext('2d')
		
		context.drawImage(images['background'], 0, 0)

		const nums = text.split('')
		for (let k=0; k<nums.length; k++) {
			const x = left + (diceSize + spacing) * k
			const y = top
			context.drawImage(images[nums[k]], x, y)
		}
		const title = 'Hi, World!'
		context.font = 'bold 40pt Menlo'
		context.textAlign = 'center'
		context.fillStyle = '#fff'
		context.fillText(title, w / 2, 110)

		const buffer = canvas.toBuffer('image/png')
			const filename = +new Date() + '.png'
			fs.writeFileSync(__dirname + '/../images/' + filename, buffer)
			return filename
	}
	return null
}

const handleWebHook = async (event:any, source:ChatSourceType, message:ChatMessageType):Promise<boolean> => {
	try {
		if (message.type !== "text") return false
		const replyToken = event.replyToken
		const [cmd, params] = message.text.split(' ')
		if (isAdmin(source.userId) && source.groupId===undefined) {
			const result = await parseAdminCommand(replyToken, cmd, params)
			if (result===true) return true
		}
		return await parseCommand(source.groupId || '', source.userId, replyToken, cmd, params)
	} catch (error) {
		console.log(error)
	}
	return false
};


const parseAdminCommand = async (replyToken:string, cmd:string, param:string):Promise<boolean> => {
	try {
		switch (cmd) {
		case AdminCommands.start:
			break
		case AdminCommands.stop:
			break
		case AdminCommands.deposit:
			{
				if (param==='') {
					await replyMessage(replyToken, ERROR_INVALID_PARAM)
					return false
				}
				const [ sid, samount ] = param.split(' ')
				const id = Number(sid)
				const amount = Number(samount)
				if (isNaN(id) || isNaN(amount)) {
					await replyMessage(replyToken, ERROR_INVALID_PARAM)
					return false
				}
				const user = await getUserById(id)
				if (user===null) {
					await replyMessage(replyToken, ERROR_NOT_EXISTS_USER)
				} else {
					const balance = user.balance + amount
					await updateUser(id, { balance, updated:now() })
					await replyMessage(replyToken, MSG_DEPOSIT_SUCCESS.replace('{user}', String(id)))
				}
			}
			break
		case AdminCommands.statistic:
			break
		default: 
			return false
		}
		return true
	} catch (error) {
		setlog("parseAdminCommand", error)
	}
	return false
}

const parseCommand = async (groupId:string, userId:string, replyToken:string, cmd:string, param:string):Promise<boolean> => {
	try {
		if (groupId!=='') await insertGroupId(groupId)
		if (!currentRound.started) {
			await replyMessage(replyToken, MSG_NOT_STARTED)
			return false
		}
		const user = await getOrCreateUser(userId)
		switch (cmd) {
		case Commands.cancel:
			{
				if (user.betting) {
					const balance = user.balance + user.betAmount
					await updateUser(userId, { betting:false, balance, betTier:'' })
					await replyMessage(replyToken, MSG_CANCEL_BET)
				} else {
					await replyMessage(replyToken, MSG_CANCEL_BET_NOT_STARTED)
				}
			}
			break
		case Commands.balance:
			{	
				await replyMessage(replyToken, MSG_BALANCE.replace('{balance}', String(user.balance)))
			}
			break
		case Commands.help:
			{
				await replyMessage(replyToken, MSG_GAME_RULE)
			}
			break
		case Commands.stopBet:

			break
		case Commands.rolling:
			if (!param || param.length!==3 ) {
				await replyMessage(replyToken, ERROR_REQUIRE_BANK)
				return false
			}
			// await updateUser(userId, { bankAccount:param })
			await replyDieImage(replyToken, param)
			break
		case Commands.bankAccount:
			{
				if (!param) {
					await replyMessage(replyToken, ERROR_REQUIRE_BANK)
					return false
				}
				await updateUser(userId, { bankAccount:param })
				await replyMessage(replyToken, MSG_REGISTERED_BANK)
			}
			break
		case Commands.pastRounds:
			break
		}
		return true
	} catch (error) {
		setlog("parseCommand", error)
	}
	return false
}

const getUserById = async (id:number) => {
	return await Users.findOne({ id })
}

const insertGroupId = async (groupId:string) => {
	await Groups.updateOne({ groupId }, { $set: { groupId, updated:now() } }, { upsert:true })
}

const getOrCreateUser = async (userId:string) => {
	let row = await Users.findOne({userId})
	if (row===null) {
		const user = {
			id:				Math.round(Math.random()*89999998) + 10000001,
			userId,
			bankAccount:	'',
			betting: 		false,
			betAmount: 		0,
			betTier: 		'',
			balance: 		0,
			updated: 		0,
			created: 		now()
		} as SchemaUsers
		await Users.insertOne(user)
		return user
	}
	return row
}

const updateUser = async (userId:string|number, params:Partial<SchemaUsers>) => {
	if (typeof userId==="string") {
		await Users.updateOne({ userId }, {$set:params})
	} else {
		await Users.updateOne({ id:userId }, {$set:params})
	}
	return true
}

export default router