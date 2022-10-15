`use strict`;
import {GameSnapshotReader, PLAYER_STATE, Lugo, SPECS, Bot, Mapper, Region, geo} from '@lugobots/lugo4node'
import {getMyExpectedPosition} from './settings';

const TEAM_HOME = Lugo.Team.Side.HOME
const TEAM_AWAY = Lugo.Team.Side.AWAY

export class MyBot implements Bot {

    side: Lugo.Team.Side;

    number: number;

    initPosition: Lugo.Point;

    mapper: Mapper;

    constructor(side: Lugo.Team.Side, number: number, initPosition: Lugo.Point, mapper: Mapper) {
        this.side = side
        this.number = number
        this.mapper = mapper
        this.initPosition = initPosition
    }

    onDisputing(orderSet: Lugo.OrderSet, snapshot: Lugo.GameSnapshot): Lugo.OrderSet {
        try {
            const {reader, me} = this.makeReader(snapshot)
            const ballPosition = snapshot.getBall().getPosition()           

            const ballRegion = this.mapper.getRegionFromPoint(ballPosition)
            const myRegion = this.mapper.getRegionFromPoint(me.getPosition())

            // by default, I will stay at my tactic position
            let moveDestination = getMyExpectedPosition(reader, this.mapper, this.number)
            orderSet.setDebugMessage("returning to my position")
            
            // if the ball is max 2 blocks away from me, I will move toward the ball
            if(this.shouldICatchTheBall(reader, me)) {
                moveDestination = ballPosition
                orderSet.setDebugMessage("trying to catch the ball")
            }

            const moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination)
            // we can ALWAYS try to catch the ball it we are not holding it
            const catchOrder = reader.makeOrderCatch()

            orderSet.setOrdersList([moveOrder, catchOrder])
            return orderSet
        } catch (e) {
            console.log(`did not play this turn`, e)
        }
    }

    onDefending(orderSet: Lugo.OrderSet, snapshot: Lugo.GameSnapshot): Lugo.OrderSet {
        try {
            const {reader, me} = this.makeReader(snapshot)
            const ballPosition = snapshot.getBall().getPosition()
            const ballRegion = this.mapper.getRegionFromPoint(ballPosition)
            const myRegion = this.mapper.getRegionFromPoint(me.getPosition())

            // by default, I will stay at my tactic position
            let moveDestination = getMyExpectedPosition(reader, this.mapper, this.number)
            orderSet.setDebugMessage("returning to my position")
            // if the ball is max 2 blocks away from me, I will move toward the ball
            if(this.shouldICatchTheBall(reader, me)) {
                moveDestination = ballPosition
                orderSet.setDebugMessage("trying to catch the ball")
            }
            const moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination)
            const catchOrder = reader.makeOrderCatch()

            orderSet.setOrdersList([moveOrder, catchOrder])
            return orderSet
        } catch (e) {
            console.log(`did not play this turn`, e)
        }
    }

    onHolding(orderSet: Lugo.OrderSet, snapshot: Lugo.GameSnapshot): Lugo.OrderSet {
        try {
            const {reader, me} = this.makeReader(snapshot)

            const myGoalCenter = this.mapper.getRegionFromPoint(reader.getOpponentGoal().getCenter())
            const currentRegion = this.mapper.getRegionFromPoint(me.getPosition())

            let myOrder;
            if (this.isINear(currentRegion, myGoalCenter, 0)) {
                myOrder = reader.makeOrderKickMaxSpeed(snapshot.getBall(), reader.getOpponentGoal().getCenter())
            } else {
                const closeOpponents = this.nearestPlayers(
                    reader.getTeam(reader.getOpponentSide()).getPlayersList(),
                    me.getPosition(),
                    1, [])


                if (closeOpponents[0].dist < SPECS.PLAYER_SIZE * 3) {
                    const closeMate = this.nearestPlayers(
                        reader.getMyTeam().getPlayersList(),
                        me.getPosition(),
                        1, [1, this.number])
                    myOrder = reader.makeOrderKickMaxSpeed(reader.getBall(), closeMate[0].player.getPosition())
                } else {
                    myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), reader.getOpponentGoal().getCenter())
                }
            }
            orderSet.setDebugMessage("attack!")
            orderSet.setOrdersList([myOrder])
            return orderSet
        } catch (e) {
            console.log(`did not play this turn`, e)
        }
    }

    onSupporting(orderSet: Lugo.OrderSet, snapshot: Lugo.GameSnapshot): Lugo.OrderSet {
        try {
            const { reader, me } = this.makeReader(snapshot)
            const ballPosition = snapshot.getBall().getPosition()

            let moveDestination = getMyExpectedPosition(reader, this.mapper, this.number)
            orderSet.setDebugMessage("returning to my position")

            if (reader.getBall().getHolder().getNumber() == 1 && this.number == 2) {
                moveDestination = getMyExpectedPosition(reader, this.mapper, this.number)
                const myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination)
                orderSet.setDebugMessage("assisting the goalkeeper")
                orderSet.setOrdersList([myOrder])
                return orderSet
            }

            const closePlayers = this.nearestPlayers(reader.getMyTeam().getPlayersList(), ballPosition, 3,
                [1,
                    snapshot.getBall().getHolder().getNumber()
                ])

            if (closePlayers.find(info => info.number == this.number)) {
                const distToMate = geo.distanceBetweenPoints(me.getPosition(), ballPosition)
                if (distToMate > SPECS.PLAYER_SIZE * 4) {
                    moveDestination = ballPosition
                } else {
                    // todo find the best position?
                    moveDestination = reader.getOpponentGoal().getCenter()
                }
            }

            const moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination)
            // we can ALWAYS try to catch the ball it we are not holding it
            const catchOrder = reader.makeOrderCatch()

            orderSet.setOrdersList([moveOrder, catchOrder])
            return orderSet
        } catch (e) {
            console.log(`did not play this turn`, e)
        }
    }

    asGoalkeeper(orderSet: Lugo.OrderSet, snapshot: Lugo.GameSnapshot, state: PLAYER_STATE): Lugo.OrderSet {
        try {
            const {reader, me} = this.makeReader(snapshot)
            let position = reader.getBall().getPosition()
            if (state !== PLAYER_STATE.DISPUTING_THE_BALL) {
                position = reader.getMyGoal().getCenter()
            }

            if (state === PLAYER_STATE.HOLDING_THE_BALL) {
                position = reader.getPlayer(this.side, 2).getPosition()
                if (snapshot.getTurnsBallInGoalZone() > SPECS.BALL_TIME_IN_GOAL_ZONE * 0.80) {
                    orderSet.setDebugMessage("returning the ball")
                    const kick = reader.makeOrderKickMaxSpeed(reader.getBall(), position)
                    orderSet.setOrdersList([kick])
                    return orderSet
                }
            }

            const myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), position)

            orderSet.setDebugMessage("supporting")
            orderSet.setOrdersList([myOrder, reader.makeOrderCatch()])
            return orderSet
        } catch (e) {
            console.log(`did not play this turn`, e)
        }
    }

    gettingReady(snapshot: Lugo.GameSnapshot): void {
        // This method is called when the score is changed or before the game starts.
        // We can change the team strategy or do anything else based on the outcome of the game so far.
        // for now, we are not going anything here.
    }

    private isINear(myPosition: Region, targetPosition: Region, minDist: number): boolean {
        const colDist = myPosition.getCol() - targetPosition.getCol()
        const rowDist = myPosition.getRow() - targetPosition.getRow()
        return Math.hypot(colDist, rowDist) <= minDist
    }


    /**
     * This method creates a snapshot reader. The Snapshot readers reads the game state and return elements we may need.
     * E.g. Players, the ball, etc.
     */
    private makeReader(snapshot: Lugo.GameSnapshot): { reader: GameSnapshotReader, me: Lugo.Player } {
        const reader = new GameSnapshotReader(snapshot, this.side)
        const me = reader.getPlayer(this.side, this.number)
        if (!me) {
            throw new Error("did not find myself in the game")
        }
        return {reader, me}
    }

    private shouldICatchTheBall(reader: GameSnapshotReader, me: Lugo.Player): boolean {
        const ballPosition = reader.getBall().getPosition()
        const ballRegion = this.mapper.getRegionFromPoint(ballPosition)
        const myRegion = this.mapper.getRegionFromPoint(me.getPosition())

        if (!this.isINear(myRegion, ballRegion, 2)) {
            return false
        }

        let shouldGo = true

        const myDistance = geo.distanceBetweenPoints(ballPosition, me.getPosition())

        // unless, there are other players closer to the ball
        let closerPlayers = 0
        for (const player of reader.getMyTeam().getPlayersList()) {
            const playerRegion = this.mapper.getRegionFromPoint(player.getPosition())
            const playerDistance = geo.distanceBetweenPoints(ballPosition, player.getPosition())
            if (player.getNumber() != 1 && this.isINear(playerRegion, ballRegion, 2) && playerDistance < myDistance) {
                closerPlayers += 1
                if (closerPlayers >= 2) {
                    shouldGo = false
                    break
                }
            }
        }
        return shouldGo;
    }

    private nearestPlayers(players: Array<Lugo.Player>, pointTarget: Lugo.Point, count: number, ignore: Array<number>): Array<{ dist: number, number: number, player: Lugo.Player }> {
        let playersDist = []

        for (const player of players) {
            if (ignore.includes(player.getNumber())) {
                continue
            }
            playersDist.push({
                dist: geo.distanceBetweenPoints(player.getPosition(), pointTarget),
                number: player.getNumber(),
                player: player,
            })
        }

        playersDist.sort((a, b) => {
            return a.dist - b.dist
        });
        return playersDist.slice(0, count)
    }

}