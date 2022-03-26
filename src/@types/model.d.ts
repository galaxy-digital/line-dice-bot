declare interface SchemaUsers {
	id: 			number
	userId: 		string
	balance:		number
	betting:		boolean
	betAmount:		number
	betTier:		string
	bankAccount:	string
	updated:		number
	created:		number
}

declare interface SchemaRounds {
	
	updated:		number
	created:		number
}

declare interface ChatSourceType {
	type:			"user"|"group"
	groupId?:		string
	userId:			string
}

declare interface ChatMessageType {
	type: 			"text",
	id: 			number
	text: 			string
}