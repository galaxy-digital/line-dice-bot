require("dotenv").config()
import * as express from 'express'
import * as fs from 'fs'
import { setlog } from './helper'
import * as line from '@line/bot-sdk'
import { Bettings, Rounds, Users } from './Model';
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

interface RoundResultType {
	roundId:	number
	result:		string
}

// 管理命令
const AdminCommands = {
	start: 			"/start",		// 开始下注
	stop: 			"/B",			// 终了下注
	deposit: 		"/D",		// 用户充值 
	result:			"/S",			// 
}
// 管理命令
const GuestCommands = {
	cancel:			"/X",
	balance:		"/C",
	help:			"/A",
	bankAccount:	"/Y",
	pastRounds:		"/N",
	methodSingle:	"/"
}

// 投注命令 （改时候，别用短号或空白字）
const BetCommands = {
	big: "大",
	small: "小",
	odd: "单",
	even: "双",
}
const BetCommandList = Object.values(BetCommands).map(i=>i.toLowerCase())
const BetCommandPattern = new RegExp('[^0-9' + BetCommandList.join('') + ']', 'g')

let currentRound = {
	roundId:		0,
	started:		false,
	stopped:		false
}
const names = {} as {[id:number]:string}

const MSG_REPLY_ADMIN = `管理员`
const MSG_REPLY_GUEST = `用户ID: 🙂{uid}`
const MSG_BET_TOTAL = `总和: {total}`
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

const MSG_NOT_STARTED = '投注还没开始。'
const MSG_NOT_COMPLETED = '当前下注还没终了。'
const MSG_STARTED = '🚩{roundId}投注开始了。'
const MSG_STOPPED = '🚩{roundId}投注停止了。'

const MSG_CANCEL_BET = '您的投注已取消。' // Your bet has been cancelled
const MSG_DEPOSIT_SUCCESS = '存款 {amount}成功。'
const MSG_RESULT = '🚩{roundId}投注结果'

const ERROR_UNKNOWN_COMMAND = '无效命令'
const ERROR_UNKNOWN_ERROR = '无知错误'
const ERROR_REQUIRE_BANK = '命令错误: /Y {银行账户}'
const ERROR_INVALID_PARAM = '无效参数'
const ERROR_NOT_EXISTS_USER = '用户不存在。'
const ERROR_NOT_BETTED = "您还没下注。"
const ERROR_BET_BALANCE = "不够余额。"
const ERROR_ALREADY_STARTED = "🚩{roundId}投注已经开始。"
const ERROR_ALREADY_STOPPED = "🚩{roundId}投注已经停止。"
const ERROR_GROUP_COMMAND = "It can only be used in groups."
const ERROR_NO_RESULT = "no past result"
const images = {} as {[key:string]:Image}

export const replyMessage = (uid:number|null, replyToken:string, message:string) => {
	let text = ''
	if (uid!==null) {
		if (uid===0) {
			text = MSG_REPLY_ADMIN
		} else {
			if (names[uid]!==undefined) {
				text = MSG_REPLY_GUEST.replace('{uid}', `${ String(uid) } (${ names[uid] })`)
			} else {
				text = MSG_REPLY_GUEST.replace('{uid}', String(uid))
			}
		}
		text += '\r\n\r\n'
	} 
	text += message
	const data = { type: 'text', text } as line.Message;
	  
	client.replyMessage(replyToken, data).then((res) => {
		console.log(res)
	}).catch((err) => {
		console.log('message', text)
		console.log(err)
	});
}

export const pushMessage = (chatId:string, text:string) => {
	const data = { type: 'text', text } as line.Message;
	  
	client.pushMessage(chatId, data).then((res) => {
		console.log(res)
	}).catch((err) => {
		console.log('message', text)
		console.log(err)
	});
}

export const replyImage = async (replyToken:string, uri:string) => {
	const message = {
		type: 'image',
		originalContentUrl: serverUrl + '/' + uri,
		previewImageUrl: serverUrl + '/' + uri
	} as line.Message
	  
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
	}
	const users = await Users.find().toArray()
	for (let i of users) names[i.id] = i.displayName

	const row = await Rounds.findOne({ result:{ $exists:false } })
	if (row!==null) {
		currentRound.roundId = row.roundId || 1001
		currentRound.started = !!row.started
		currentRound.stopped = !!row.stopped
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

/* router.post("/webhook-test", (req:express.Request, res:express.Response)=>{
	const body = req.body
	res.status(200).send('');
}) */

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

const getPastResultImage = async (rows:Array<RoundResultType>) => {
	const diceSize = 80
	let left = 50
	let top = 50
	let spacing = 25
	
	const w = 800
	const h = top * 2 + (diceSize + spacing) * (rows.length - 1)

	const diceLeft = w - left - diceSize * 3 - spacing * 2
	const canvas = createCanvas(w, h)
	const context = canvas.getContext('2d')
	
	// context.drawImage(images['background'], 0, 0)
	// draw header 
	
	for (let m = 0; m<rows.length; m++) {
		const i = rows[m]

		const title = `Round ${i.roundId}`
		context.font = 'bold 40pt Menlo'
		context.textAlign = 'left'
		// context.fillStyle = '#fff'
		
		context.fillText(title, left, top + (diceSize + spacing) * m + (diceSize + 40) / 2 )

		const nums = i.result.split('')
		for (let k=0; k<nums.length; k++) {
			const x = diceLeft + (diceSize + spacing) * k
			const y = top + (diceSize + spacing) * m
			context.drawImage(images[nums[k]], 0, 0, 128, 128, x, y, diceSize, diceSize)
		}
	}
	const buffer = canvas.toBuffer('image/png')
	const filename = +new Date() + '.png'
	fs.writeFileSync(__dirname + '/../images/' + filename, buffer)
	return filename
}

const handleWebHook = async (event:any, source:ChatSourceType, message:ChatMessageType):Promise<boolean> => {
	try {
		if (message.type !== "text") return false
		const replyToken = event.replyToken
		const p = message.text.indexOf(' ')
		let cmd = '', params = ''
		if (p===-1) {
			cmd = message.text.trim()
		} else {
			cmd = message.text.slice(0, p).trim()
			params = message.text.slice(p + 1).trim()
		}
		if (isAdmin(source.userId)) {
			const result = await parseAdminCommand(source.groupId || '', replyToken, cmd, params)
			if (result===true) return true
		}
		return await parseCommand(source.groupId || '', source.userId, replyToken, cmd, params)
	} catch (error) {
		console.log(error)
	}
	return false
};

const validateCommand = (cmd:string):string[]|null => {
	const result = [] as string[]
	const len = cmd.length
	let k = 0
	while (k < len) {
		let pk = k
		for (let i of BetCommandList) {
			if (cmd.slice(k).indexOf(i)===0) {
				k += i.length
				result.push(i)
				if (k===len-1) break
			}
		}
		if (k < len) {
			if (/[1-6]/.test(cmd[k])) {
				result.push(cmd[k])
				k++
			}
		}
		if (pk===k) return null
	}
	return result.length===0 ? null : result
}

const parseAdminCommand = async (groupId:string, replyToken:string, cmd:string, param:string):Promise<boolean> => {
	try {
		switch (cmd) {
		case AdminCommands.start:
			{
				if (currentRound.roundId!==0) {
					await replyMessage(0, replyToken, ERROR_ALREADY_STARTED.replace('{roundId}', String(currentRound.roundId)))
					return false
				}
				await startRound()
				await replyMessage(0, replyToken, MSG_STARTED.replace('{roundId}', String(currentRound.roundId)))
			}
			break
		case AdminCommands.stop:
			{
				if (currentRound.roundId===0 || !currentRound.started) {
					await replyMessage(0, replyToken, MSG_NOT_STARTED)
					return false
				}
				if (currentRound.stopped) {
					await replyMessage(0, replyToken, ERROR_ALREADY_STOPPED.replace('{roundId}', String(currentRound.roundId)))
					return false
				}

				await replyMessage(0, replyToken, MSG_STOPPED.replace('{roundId}', String(currentRound.roundId)))
				await stopRound()
			}
			break
		case AdminCommands.deposit:
			{
				if (param==='') {
					await replyMessage(0, replyToken, ERROR_INVALID_PARAM)
					return false
				}
				const [ sid, samount ] = param.split(' ')
				const id = Number(sid)
				const amount = Number(samount)
				if (isNaN(id) || isNaN(amount)) {
					await replyMessage(0, replyToken, ERROR_INVALID_PARAM)
					return false
				}
				const user = await getUserById(id)
				if (user===null) {
					await replyMessage(0, replyToken, ERROR_NOT_EXISTS_USER)
				} else {
					const balance = user.balance + amount
					await updateUser(id, { balance, updated:now() })
					await replyMessage(id, replyToken, MSG_DEPOSIT_SUCCESS.replace('{amount}', String(amount)))
				}
			}
			break
		case AdminCommands.result:
			{
				if (groupId!=='') {
					const roundId = currentRound.roundId
					if (roundId!==0 && currentRound.started) {
						if ( !/^[1-6]{3,3}$/.test(param) ) {
							await replyMessage(0, replyToken, ERROR_UNKNOWN_COMMAND)
							return false
						}
						const uri = await getDiceImage(param)
						if (uri) {
							await replyImage(replyToken, uri)
							const result = await updateRoundAndGetResults(param)
							if (result.length) {
								let ls = [] as string[]
								for (let i of result) {
									const t1 = `#${i.uid}`
									const t2 = `${ (i.rewards>0 ? '+' : '') + i.rewards } = ${ i.balance }`
									ls.push([ t1, ' '.repeat(30 - t1.length - t2.length), t2 ].join(''))
								}
								await pushMessage(groupId, MSG_RESULT.replace('{roundId}', String(roundId)) + '\r\n\r\n' + ls.join('\r\n'))
							}
						} else {
							await replyMessage(0, replyToken, ERROR_UNKNOWN_ERROR)
						}
					} else {
						await replyMessage(0, replyToken, MSG_NOT_STARTED)
					}
				} else {
					await replyMessage(0, replyToken, ERROR_GROUP_COMMAND)
				}
			}
			break
		default: 
			return false
		}
		return true
	} catch (error) {
		setlog("parseAdminCommand", error)
		await replyMessage(null, replyToken, ERROR_UNKNOWN_ERROR)
	}
	return false
}

const checkRound = async (uid:number, replyToken:string) => {
	if (!currentRound.started) {
		await replyMessage(uid, replyToken, MSG_NOT_STARTED)
		return false
	}
	if (currentRound.stopped) {
		await replyMessage(uid, replyToken, MSG_STOPPED.replace('{roundId}', String(currentRound.roundId)))
		return false
	}
	return true
}

const parseCommand = async (groupId:string, userId:string, replyToken:string, cmd:string, param:string):Promise<boolean> => {
	try {
		// if (groupId!=='') await insertGroupId(groupId)
		const user = await getOrCreateUser(userId)
		const uid = user.id
		
		switch (cmd) {
		case GuestCommands.cancel:
			{
				const _round = await checkRound(uid, replyToken)
				if (!_round) return false
				const rows = await Bettings.find({ uid }).toArray()
				if (rows && rows.length) {
					let total = 0
					for (let i of rows) {
						total += i.amount
					}
					await Bettings.deleteMany({ uid })
					await updateUser(userId, { balance:user.balance + total })
					await replyMessage(uid, replyToken, MSG_CANCEL_BET)
				} else {
					await replyMessage(uid, replyToken, ERROR_NOT_BETTED)
				}
			}
			break
		case GuestCommands.balance:
			{	
				await replyMessage(uid, replyToken, MSG_BALANCE.replace('{balance}', String(user.balance)))
			}
			break
		case GuestCommands.help:
			{
				await replyMessage(uid, replyToken, MSG_GAME_RULE)
			}
			break
		case GuestCommands.bankAccount:
			{
				if (!param) {
					await replyMessage(uid, replyToken, ERROR_REQUIRE_BANK)
					return false
				}
				await updateUser(userId, { bankAccount:param })
				await replyMessage(uid, replyToken, MSG_REGISTERED_BANK)
			}
			break
		case GuestCommands.pastRounds:
			{
				const rows = await getPastResults()
				if (rows.length) {
					const uri = await getPastResultImage(rows)
					if (uri) {
						await replyImage(replyToken, uri)
					} else {
						await replyMessage(0, replyToken, ERROR_UNKNOWN_ERROR)
					}
				} else {
					await replyMessage(0, replyToken, ERROR_NO_RESULT)
				}
			}
			break
		default:
			{
				// 处理多行命令
				const lines = (cmd + ' ' + param).toLowerCase().split(/\r\n|\r|\n/g)
				const bs = [] as Array<{ bets:string[], amount:number }>
				let total = 0
				for (let line of lines) {
					const x = line.trim().split(BetCommandPattern)
					if (x.length===2 || x.length===3) {
						let bets = [] as string[]
						for (let k=0; k<x.length - 1; k++) {
							const cs = validateCommand(x[k])
							if (cs===null) {
								// await replyMessage(uid, replyToken, ERROR_UNKNOWN_COMMAND)
								return false
							}
							for (let i of cs) {
								bets.push(i)
							}
						}
						if (bets.length) {
							const amount = Number(x[x.length-1])
							if (isNaN(amount)) {
								// await replyMessage(uid, replyToken, ERROR_UNKNOWN_COMMAND)
								return false
							} else {
								total += amount
							}
							bs.push({ bets, amount })
						}
					}
				}
				const _round = await checkRound(uid, replyToken)
				if (!_round) return false

				if (bs.length===0) {
					// await replyMessage(uid, replyToken, ERROR_UNKNOWN_COMMAND)
					return false
				}
				if (total>user.balance) {
					await replyMessage(uid, replyToken, ERROR_BET_BALANCE)
					return false
				}
				let ls = [] as string[]
				const balance = user.balance - total
				await updateUser(userId, { balance })
				total = 0
				const rows = await addAndGetBetting(user.id, bs)
				for (let i of rows) {
					total += i.amount
					ls.push(`${i.cmd} => ${i.amount} `)
				}
				ls.push(MSG_BET_TOTAL.replace('{total}', String(total)))
				await replyMessage(uid, replyToken, ls.join('\r\n'))
				return true
			}
			// await replyMessage(uid, replyToken, ERROR_UNKNOWN_COMMAND)
			break
		}
		return true
	} catch (error) {
		setlog("parseCommand", error)
		await replyMessage(null, replyToken, ERROR_UNKNOWN_ERROR)
	}
	return false
}

const getUserById = async (id:number) => {
	return await Users.findOne({ id })
}

/* const insertGroupId = async (groupId:string) => {
	await Groups.updateOne({ groupId }, { $set: { groupId, updated:now() } }, { upsert:true })
} */

const startRound = async () => {
	let roundId = 1001
	const rows = await Rounds.aggregate([{$group: {_id: null, max: { $max : "$roundId" }}}]).toArray();
	if (rows.length>0) {
		roundId = rows[0].max + 1
	}
	await Rounds.insertOne({
		roundId,
		started: true,
		stopped: false,
		totalBetting: 0,
		totalRewards: 0,
		updated: 0,
		created: 0
	})
	currentRound.roundId = roundId
	currentRound.started = true
	currentRound.stopped = false
}

const stopRound = async () => {
	await Rounds.updateOne({ roundId:currentRound.roundId }, { $set:{ stopped: true, updated: now() } })
	currentRound.stopped = true
}

const calculateRewardsOfBetting = (result:string, amount:number, bets:string[]):number => {
	const rs = result.split('')
	let sum = 0
	let rate = 0
	for (let i of rs) sum += Number(i)
	let isLeopard = rs[0]===rs[1] && rs[1]===rs[2]
	let isSingle = false
	for (let i of bets) {
		if (BetCommands.small===i) {
			if (isLeopard) return 0
			if (sum>=4 && sum<=10) {
				isSingle = true
				rate = rate===0 ? 2 : 3.3
			} else {
				return 0
			}
		} else if (BetCommands.big===i) {
			if (isLeopard) return 0
			if (sum>=11 && sum<=17) {
				isSingle = true
				rate = rate===0 ? 2 : 3.3
			} else {
				return 0
			}
		} else if (BetCommands.odd===i) {
			if (isLeopard) return 0
			if ((sum % 2 ) == 1 && sum>=5 && sum<=17) {
				isSingle = true
				rate = rate===0 ? 2 : 3.3
			} else {
				return 0
			}
		} else if (BetCommands.even===i) {
			if (isLeopard) return 0
			if ((sum % 2 ) == 0 && sum>=4 && sum<=16) {
				isSingle = true
				rate = rate===0 ? 2 : 3.3
			} else {
				return 0
			}
		} else {
			let matchedCount = 0
			for (let r of rs) {
				if (i===r) matchedCount++
			}
			if (matchedCount===0) return 0
			if (isSingle) {
				rate = 3.3
			} else {
				if (rate!==0 && matchedCount>0) {
					rate = 6
				} else {
					if (matchedCount===1) {
						rate = 2
					} else if (matchedCount===2) {
						rate = 3
					} else if (matchedCount===3) {
						rate = 4
					}
				}
			}
		}
	}
	return amount * rate
}

const updateRoundAndGetResults = async (num:string):Promise<Array<{ uid:number, rewards:number, balance:number }>> => {
	const result = [] as Array<{ uid:number, rewards:number, balance:number }>
	const roundId = currentRound.roundId
	const rows = await Bettings.find({ roundId }).toArray()
	const us = {} as {[uid:number]:{ bet:number,rewards:number }}
	let totalBetting = 0
	let totalRewards = 0
	if (rows!==null) {
		for (let i of rows) {
			const rewards = calculateRewardsOfBetting(num, i.amount, i.bets)
			us[i.uid] ??= { bet:0,rewards:0 }
			us[i.uid].bet += i.amount
			us[i.uid].rewards += rewards
		}
		const users = await Users.find({ id:{ $in: Object.keys(us).map(i=>Number(i)) } }).toArray()
		for (let i of users) {
			const bet = us[i.id].bet
			const rewards = us[i.id].rewards
			const balance = i.balance + rewards
			if (rewards!==0) await Users.updateOne({ id:i.id }, { $set:{ balance } })
			result.push({ uid:i.id, rewards:rewards - bet, balance })
			totalBetting += us[i.id].bet
			totalRewards += rewards
		}
	}
	currentRound.roundId = 0
	currentRound.started = false
	await Rounds.updateOne({ roundId }, { $set:{ result:num, totalBetting, totalRewards, updated:now() } })
	return result
}

const getPastResults = async ():Promise<Array<RoundResultType>> => {
	const result = [] as Array<RoundResultType>
	const rows = await Rounds.find({ result:{ $exists:true } }).sort({ created:-1 }).limit(10).toArray()
	for (let k=rows.length - 1; k>=0; k--) {
		const i = rows[k]
		result.push({ roundId:i.roundId, result:i.result || '' })
	}
	return result
}

const addAndGetBetting = async (uid:number, params:Array<{bets:string[], amount:number}>):Promise<Array<{cmd:string, amount:number}>> => {
	const inserts = [] as Array<SchemaBettings>
	const created = now()
	for (let i of params) {
		inserts.push({
			roundId:		currentRound.roundId,
			uid: 			uid,
			bets:			i.bets,
			amount:			i.amount,
			rewards:		0,
			created
		})
	}
	await Bettings.insertMany(inserts)
	const result = [] as Array<{cmd:string, amount:number}>
	const rows = await Bettings.find({ roundId:currentRound.roundId, uid }).toArray()
	if (rows) {
		for (let i of rows) {
			result.push({ cmd:i.bets.join(''), amount:i.amount })
		}
	}
	return result
}

const getOrCreateUser = async (userId:string) => {
	let row = await Users.findOne({userId})
	if (row===null) {
		let id = 1001
		const rows = await Users.aggregate([{$group: {_id: null, max: { $max : "$id" }}}]).toArray();
		if (rows.length>0) id = rows[0].max + 1
		let displayName = ''
		try {
			const profile = await client.getProfile(userId)
			displayName = profile.displayName
			console.log('profile', profile)
		} catch (error) {
			console.log(error)
		}
		
		/* .then((profile) => {
			console.log(profile.displayName);
			console.log(profile.userId);
			console.log(profile.pictureUrl);
			console.log(profile.statusMessage);
		})
		.catch((err) => {
			// error handling
		}); */
		const user = {
			id,
			userId,
			displayName,
			balance: 		0,
			updated: 		0,
			created: 		now()
		} as SchemaUsers
		names[id] = displayName
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