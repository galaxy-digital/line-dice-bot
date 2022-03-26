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
	roundId:		number
	started:		boolean
	result:			string
	totalBetting:	number
	totalRewards:	number
	updated:		number
	created:		number
}

declare interface SchemaBettings {
	roundId:		number
	userId:			string
	betType:		string
	betAmount:		number
	created:		number
}

declare interface SchemaGroups {
	groupId:		string
	updated:		number
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