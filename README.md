# icicb-portal-backend
### Error Code
| code | message | meaning |
| --- | --- | --- |
| 1001 | invalid username | Usernames can only have lowercase Letters (a-z) and numbers (0-9), 3 ~ 20 characters
| 1002 | invalid email | invalid email address format
| 1003 | invalid password | invalid password length
| 1004 | unregistered user | unregistered user in server
| 1005 | no permission | the user haven't login permision
| 1006 | wrong password | password is wrong
| 1007 | duplicated | target already exist
| 1008 | already logged | already logged
| 2000 | login | require login.
| 2001 | invalid code | code must be 6 digits number.
| 2002 | unknown coin | unknown coin
| 2003 | no enough | no enough balance for purchasing ICICB
| 2004 | applied | you have already applied.
| 2005 | invalid code | the code is invalid
| 2006 | already used | the code already used by other person.
| 2007 | already taken | wallet already taken by you.
| 2008 | invalid amount | invalid amount
| 2009 | invalid chain | invalid chain
| 2010 | no address | there is no free address in system 
| 10000 | admin only | admin only
| 10001 | zero length array | zero length array
| 10002 | invalid data format | invalid data format
| -32700 | Parse error | Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. |
| -32600 | Invalid Request | The JSON sent is not a valid Request object. |
| -32601 | Method not found | The method does not exist / is not available. |
| -32602 | Invalid params | Invalid method parameter(s). |
| -32603 | Internal error | Internal JSON-RPC error. |
| -32000 | Server error | Reserved for implementation-defined server-errors. |
| -32001 | ChainApi Server error | api server-errors. |
## API
	

changed v1.1 what's new:
```
	changed type name PincodeReqeustType to CodeReqeustType
	added some fields in type LoginResponseType.
	affected apis
		/portal/login

	added type
		WalletReqeustType
		AdminQueryType
		AdminCreateType
		AdminUpdateType
		AdminDeleteType
		AdminUserType
		AdminPresaleCodeResponseType
		AdminVoucherCodeType

	added new api:
		/portal/get-user-wallet
		/portal/set-presale-code
		/portal/set-voucher
		/admin/login
		/admin/get-users
		/admin/create-user
		/admin/update-user
		/admin/delete-user
		/admin/get-presale-code
		/admin/import-presale-code
		/admin/get-voucher
		/admin/import-voucher
		/admin/get-wallets
		/admin/import-wallets
```

> /api/v1/portal/login
```
in: 
	interface LoginReqeustType {
		username: string
		password: string
	}

out: 
	interface ServerResponse {
		result?: LoginResponseType {
			token: 		string
			username:	string
			email: 		string
			pinCode: 	boolean
			presale: 	boolean
			voucher: 	boolean
			lastSeen:	number
			created: 	number
		} | undefined
		error?: number
	}
```

> api/v1/portal/register
```
in: 
	RegisterReqeustType {
		username: string
		email: string
		password: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/reset-password
```
in: 
	interface ResetReqeustType {
		email: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/set-pincode
```
in: 
	interface CodeReqeustType {
		code: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/change-password
```
in: 
	interface ChangeReqeustType {
		oldpass: string
		newpass: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/get-user-wallet
```
in: 
	interface WalletReqeustType {
		chain
	}

out: 
	interface ServerResponse {
		result?: {address:string} | undefined
		error?: number
	}
```

> /api/v1/portal/set-presale-code
```
in: 
	interface CodeReqeustType {
		code: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/set-voucher
```
in: 
	interface CodeReqeustType {
		code: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/presale
```
in: 
	interface PresaleReqeustType {
		coin: string
		quantity: string
		target: string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/portal/new-txs
```
in: none
	
out: 
	interface NewtxsResponseType {
		balances:{
			[coin:string]:{
				balance:number, 
				locked:number
			}
		}
		wallets: {
			[chain:string]:string
		}
		prices:  {
			[coin:string]:number
		}
		logs: 	 interface ChartType {
			prev?: 	Array<interface LogsType {
				coin: 	string
				usd: 	number
				updated:number
			}>
			date?: 	Array<interface LogsType {
				coin: 	string
				usd: 	number
				updated:number
			}>
			week?: 	Array<interface LogsType {
				coin: 	string
				usd: 	number
				updated:number
			}>
			month?: Array<interface LogsType {
				coin: 	string
				usd: 	number
				updated:number
			}>
		}
		txs: 	 Array<interface TxType {
			txid: 	String
			chain: 	String
			address:String
			confirms:number
			input: 	Boolean
			amount: Number
			created:Number
		}>
	}
```

> /api/v1/admin/login
```
in: 
	interface LoginReqeustType {
		username: string
		password: string
	}

out: 
	interface ServerResponse {
		result?: LoginResponseType {
			token: 		string
			username:	string
			lastSeen:	number
			created: 	number
		} | undefined
		error?: number
	}
```

> /api/v1/admin/get-users
```
in: 
	interface AdminQueryType {
		query: 	string
		page: 	number
		limit: 	number
		count:  number
	}

out: 
	interface ServerResponse {
		result?: Array<AdminUserType {
			_id: string
			username: string
			email: string
			pincode: string
			presale: string
			voucher: string
			status: number
			lastSeen:number
			created:number
		}> | undefined
		error?: number
	}
```

> /api/v1/admin/create-user
```
in: 
	interface AdminCreateType {
		username: string
		email: string
		password: string
	}

out: 
	interface ServerResponse {
		result?: {id:string} | undefined
		error?: number
	}
```

> /api/v1/admin/update-user
```
in: 
	interface AdminUpdateType {
		id:string
		[key:string]:string|number|boolean
	}

out: 
	interface ServerResponse {
		result?: Array<AdminUserType {
			_id: string
			username: string
			email: string
			pincode: string
			presale: string
			voucher: string
			status: number
			lastSeen:number
			created:number
		}> | undefined
		error?: number
	}
```

> /api/v1/admin/delete-user
```
in: 
	interface AdminDeleteType {
		id:string
	}

out: 
	interface ServerResponse {
		result?: Array<AdminUserType {
			_id: string
			username: string
			email: string
			pincode: string
			presale: string
			voucher: string
			status: number
			lastSeen:number
			created:number
		}> | undefined
		error?: number
	}
```

> /api/v1/admin/get-presale-code
```
in: none

out: 
	interface ServerResponse {
		result?: AdminStatisticResponseType {
			count:		number
			used:		number
		} | false | undefined
		error?: number
	}
```

> /api/v1/admin/import-presale-code
```
in: 
	{
		data: Array<string>
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/admin/get-voucher
```
in: none

out: 
	interface ServerResponse {
		result?: AdminStatisticResponseType {
			count:		number
			used:		number
		} | false | undefined
		error?: number
	}
```

> /api/v1/admin/import-voucher
```
in:
	{
		data: Array<AdminVoucherCodeType>
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/admin/get-wallets
```
in: none

out: 
	interface ServerResponse {
		result?: Array<AdminStatisticResponseType {
			chain:		string
			count:		number
			used:		number
		}> | false | undefined
		error?: number
	}
```

> /api/v1/admin/import-wallets
```
in:
	{
		data: Array<AdminVoucherCodeType>
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```


> /api/v1/admin/import-wallets
```
in:
	{
		data: Array<AdminVoucherCodeType>
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```