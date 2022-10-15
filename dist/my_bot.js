"use strict";
exports.__esModule = true;
exports.MyBot = void 0;
var lugo4node_1 = require("@lugobots/lugo4node");
var settings_1 = require("./settings");
var TEAM_HOME = lugo4node_1.Lugo.Team.Side.HOME;
var TEAM_AWAY = lugo4node_1.Lugo.Team.Side.AWAY;
var MyBot = /** @class */ (function () {
    function MyBot(side, number, initPosition, mapper) {
        this.side = side;
        this.number = number;
        this.mapper = mapper;
        this.initPosition = initPosition;
    }
    MyBot.prototype.onDisputing = function (orderSet, snapshot) {
        try {
            var _a = this.makeReader(snapshot), reader = _a.reader, me = _a.me;
            var ballPosition = snapshot.getBall().getPosition();
            var ballRegion = this.mapper.getRegionFromPoint(ballPosition);
            var myRegion = this.mapper.getRegionFromPoint(me.getPosition());
            // by default, I will stay at my tactic position
            var moveDestination = (0, settings_1.getMyExpectedPosition)(reader, this.mapper, this.number);
            orderSet.setDebugMessage("returning to my position");
            // if the ball is max 2 blocks away from me, I will move toward the ball
            if (this.shouldICatchTheBall(reader, me)) {
                moveDestination = ballPosition;
                orderSet.setDebugMessage("trying to catch the ball");
            }
            var moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination);
            // we can ALWAYS try to catch the ball it we are not holding it
            var catchOrder = reader.makeOrderCatch();
            orderSet.setOrdersList([moveOrder, catchOrder]);
            return orderSet;
        }
        catch (e) {
            console.log("did not play this turn", e);
        }
    };
    MyBot.prototype.onDefending = function (orderSet, snapshot) {
        try {
            var _a = this.makeReader(snapshot), reader = _a.reader, me = _a.me;
            var ballPosition = snapshot.getBall().getPosition();
            var ballRegion = this.mapper.getRegionFromPoint(ballPosition);
            var myRegion = this.mapper.getRegionFromPoint(me.getPosition());
            // by default, I will stay at my tactic position
            var moveDestination = (0, settings_1.getMyExpectedPosition)(reader, this.mapper, this.number);
            orderSet.setDebugMessage("returning to my position");
            // if the ball is max 2 blocks away from me, I will move toward the ball
            if (this.shouldICatchTheBall(reader, me)) {
                moveDestination = ballPosition;
                orderSet.setDebugMessage("trying to catch the ball");
            }
            var moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination);
            var catchOrder = reader.makeOrderCatch();
            orderSet.setOrdersList([moveOrder, catchOrder]);
            return orderSet;
        }
        catch (e) {
            console.log("did not play this turn", e);
        }
    };
    MyBot.prototype.onHolding = function (orderSet, snapshot) {
        try {
            var _a = this.makeReader(snapshot), reader = _a.reader, me = _a.me;
            var myGoalCenter = this.mapper.getRegionFromPoint(reader.getOpponentGoal().getCenter());
            var currentRegion = this.mapper.getRegionFromPoint(me.getPosition());
            var myOrder = void 0;
            if (this.isINear(currentRegion, myGoalCenter, 0)) {
                myOrder = reader.makeOrderKickMaxSpeed(snapshot.getBall(), reader.getOpponentGoal().getCenter());
            }
            else {
                var closeOpponents = this.nearestPlayers(reader.getTeam(reader.getOpponentSide()).getPlayersList(), me.getPosition(), 1, []);
                if (closeOpponents[0].dist < lugo4node_1.SPECS.PLAYER_SIZE * 3) {
                    var closeMate = this.nearestPlayers(reader.getMyTeam().getPlayersList(), me.getPosition(), 1, [1, this.number]);
                    myOrder = reader.makeOrderKickMaxSpeed(reader.getBall(), closeMate[0].player.getPosition());
                }
                else {
                    myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), reader.getOpponentGoal().getCenter());
                }
            }
            orderSet.setDebugMessage("attack!");
            orderSet.setOrdersList([myOrder]);
            return orderSet;
        }
        catch (e) {
            console.log("did not play this turn", e);
        }
    };
    MyBot.prototype.onSupporting = function (orderSet, snapshot) {
        var _this = this;
        try {
            var _a = this.makeReader(snapshot), reader = _a.reader, me = _a.me;
            var ballPosition = snapshot.getBall().getPosition();
            var moveDestination = (0, settings_1.getMyExpectedPosition)(reader, this.mapper, this.number);
            orderSet.setDebugMessage("returning to my position");
            if (reader.getBall().getHolder().getNumber() == 1 && this.number == 2) {
                moveDestination = (0, settings_1.getMyExpectedPosition)(reader, this.mapper, this.number);
                var myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination);
                orderSet.setDebugMessage("assisting the goalkeeper");
                orderSet.setOrdersList([myOrder]);
                return orderSet;
            }
            var closePlayers = this.nearestPlayers(reader.getMyTeam().getPlayersList(), ballPosition, 3, [1,
                snapshot.getBall().getHolder().getNumber()
            ]);
            if (closePlayers.find(function (info) { return info.number == _this.number; })) {
                var distToMate = lugo4node_1.geo.distanceBetweenPoints(me.getPosition(), ballPosition);
                if (distToMate > lugo4node_1.SPECS.PLAYER_SIZE * 4) {
                    moveDestination = ballPosition;
                }
                else {
                    // todo find the best position?
                    moveDestination = reader.getOpponentGoal().getCenter();
                }
            }
            var moveOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), moveDestination);
            // we can ALWAYS try to catch the ball it we are not holding it
            var catchOrder = reader.makeOrderCatch();
            orderSet.setOrdersList([moveOrder, catchOrder]);
            return orderSet;
        }
        catch (e) {
            console.log("did not play this turn", e);
        }
    };
    MyBot.prototype.asGoalkeeper = function (orderSet, snapshot, state) {
        try {
            var _a = this.makeReader(snapshot), reader = _a.reader, me = _a.me;
            var position = reader.getBall().getPosition();
            if (state !== lugo4node_1.PLAYER_STATE.DISPUTING_THE_BALL) {
                position = reader.getMyGoal().getCenter();
            }
            if (state === lugo4node_1.PLAYER_STATE.HOLDING_THE_BALL) {
                position = reader.getPlayer(this.side, 2).getPosition();
                if (snapshot.getTurnsBallInGoalZone() > lugo4node_1.SPECS.BALL_TIME_IN_GOAL_ZONE * 0.80) {
                    orderSet.setDebugMessage("returning the ball");
                    var kick = reader.makeOrderKickMaxSpeed(reader.getBall(), position);
                    orderSet.setOrdersList([kick]);
                    return orderSet;
                }
            }
            var myOrder = reader.makeOrderMoveMaxSpeed(me.getPosition(), position);
            orderSet.setDebugMessage("supporting");
            orderSet.setOrdersList([myOrder, reader.makeOrderCatch()]);
            return orderSet;
        }
        catch (e) {
            console.log("did not play this turn", e);
        }
    };
    MyBot.prototype.gettingReady = function (snapshot) {
        // This method is called when the score is changed or before the game starts.
        // We can change the team strategy or do anything else based on the outcome of the game so far.
        // for now, we are not going anything here.
    };
    MyBot.prototype.isINear = function (myPosition, targetPosition, minDist) {
        var colDist = myPosition.getCol() - targetPosition.getCol();
        var rowDist = myPosition.getRow() - targetPosition.getRow();
        return Math.hypot(colDist, rowDist) <= minDist;
    };
    /**
     * This method creates a snapshot reader. The Snapshot readers reads the game state and return elements we may need.
     * E.g. Players, the ball, etc.
     */
    MyBot.prototype.makeReader = function (snapshot) {
        var reader = new lugo4node_1.GameSnapshotReader(snapshot, this.side);
        var me = reader.getPlayer(this.side, this.number);
        if (!me) {
            throw new Error("did not find myself in the game");
        }
        return { reader: reader, me: me };
    };
    MyBot.prototype.shouldICatchTheBall = function (reader, me) {
        var ballPosition = reader.getBall().getPosition();
        var ballRegion = this.mapper.getRegionFromPoint(ballPosition);
        var myRegion = this.mapper.getRegionFromPoint(me.getPosition());
        if (!this.isINear(myRegion, ballRegion, 2)) {
            return false;
        }
        var shouldGo = true;
        var myDistance = lugo4node_1.geo.distanceBetweenPoints(ballPosition, me.getPosition());
        // unless, there are other players closer to the ball
        var closerPlayers = 0;
        for (var _i = 0, _a = reader.getMyTeam().getPlayersList(); _i < _a.length; _i++) {
            var player = _a[_i];
            var playerRegion = this.mapper.getRegionFromPoint(player.getPosition());
            var playerDistance = lugo4node_1.geo.distanceBetweenPoints(ballPosition, player.getPosition());
            if (player.getNumber() != 1 && this.isINear(playerRegion, ballRegion, 2) && playerDistance < myDistance) {
                closerPlayers += 1;
                if (closerPlayers >= 2) {
                    shouldGo = false;
                    break;
                }
            }
        }
        return shouldGo;
    };
    MyBot.prototype.nearestPlayers = function (players, pointTarget, count, ignore) {
        var playersDist = [];
        for (var _i = 0, players_1 = players; _i < players_1.length; _i++) {
            var player = players_1[_i];
            if (ignore.includes(player.getNumber())) {
                continue;
            }
            playersDist.push({
                dist: lugo4node_1.geo.distanceBetweenPoints(player.getPosition(), pointTarget),
                number: player.getNumber(),
                player: player
            });
        }
        playersDist.sort(function (a, b) {
            return a.dist - b.dist;
        });
        return playersDist.slice(0, count);
    };
    return MyBot;
}());
exports.MyBot = MyBot;
