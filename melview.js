const superagent = require('superagent');
const debug = require('debug')('melview');
const moment = require('moment');
const { Enum } = require('./enum');

const API_ROOT = 'https://api.melview.net/api';

class Melview {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    static hasCookieExpired(cookieString) {
        let expiryStr = Object.fromEntries(cookieString.split(';').map(s => s.trim().split('=')))['expires'];
        return moment(expiryStr.replace(/-/g,' ')).isBefore();
    } 

    async _cookie() {

        if(this.cookie && !Melview.hasCookieExpired(this.cookie)) {
            debug(`returning cached cookie as it's not yet expired`)
            return this.cookie;
        }

        let res = await superagent.post(`${API_ROOT}/login.aspx`).send({
            "user": this.username,
            "pass": this.password,
            "appversion": "3.0.539"
        });
        debug(`Fetched cookie`);
    
        if(res.ok) {
            debug(`Cookie=${res.header['set-cookie']}`)
            let cookie = res.header['set-cookie'][0];

            if(!cookie || Melview.hasCookieExpired(cookie)) {
                throw `Failed to retreive cookie. Login failed (for user ${this.username})?`
            }

            this.cookie = cookie;
            return cookie;
        } else {
            throw `Cookie request failed: ` + res.body
        }
    }

    async _req(resource, data) {
        let res = await superagent
            .post(`${API_ROOT}/${resource}.aspx`)
            .set('Cookie', await this._cookie())
            .send(data)

        if(res.ok) {
            return res.body;
        } else {
            throw `Request failed: ` + res.body
        }
    }

    async _sendCommand(unitId, command) {
        return await this._req("unitcommand", {
            unitid: unitId,
            v: 3, //verbosity
            commands: command,
            lc: 1
        })
    }

    async unit(unitId, roomName) {
        let unitDef = await this._req("unitcommand", {
            unitid: unitId,
            v: 3, //verbosity
            lc: 1
        });

        let $this = this;

        return {
            power: Power.enumFromOutgoing(unitDef.power),
            fanSpeed: FanSpeed.enumFromOutgoing(unitDef.setfan),
            mode: Mode.enumFromOutgoing(unitDef.setmode),
            roomName: roomName,
            id: unitId,
            ambientTemperature: unitDef.roomtemp,
            targetTemperature: unitDef.settemp,
            async setMode(mode) {
                if(!mode) throw `Invalid MODE ${mode}`;

                return await $this._sendCommand(unitId, mode.command())
            },
            async setFanSpeed(fanSpeed) {
                if(!fanSpeed) throw `Invalid FanSpeed ${fanSpeed}`;

                return await $this._sendCommand(unitId, fanSpeed.command())
            },
            async setPower(power) {
                if(!power) throw `Invalid POWER ${power}`;

                return await $this._sendCommand(unitId, power.command())
            },
            async setTemperature(tempFloat) {
                if(!tempFloat) throw `Invalid POWER ${tempFloat}`;

                return await $this._sendCommand(unitId, `TS${tempFloat}`)
            },
            async capabilities() {
                return await $this._req('unitcapabilities', {
                    unitid: unitId
                })
            }
        };
    }

    async buildings() {
        let buildings = await this._req("rooms");

        let units = (unitDefs) => Promise.all(unitDefs.map(unitDef => this.unit(unitDef.unitid, unitDef.room)));

        return await Promise.all(buildings.map(async buildingDef => ({
            name: buildingDef.building,
            id: buildingDef.buildingid,
            units: (await units(buildingDef.units))
        })))
    }

}

class Mode extends Enum {
    constructor(id) {
        super();
        this.inId = this.outId = id;
    }

    command() {
        return `MD${this.outId}`;
    }

    static HEAT = new Mode(1);
    static DRY = new Mode(2);
    static COOL = new Mode(3);
    static FAN = new Mode(7);
    static AUTO = new Mode(8);
}

class FanSpeed extends Enum {
    constructor(id) {
        super();
        this.inId = this.outId = id;
    }

    command() {
        return `FS${this.outId}`;
    }

    static 0 = new FanSpeed(1);
    static 1 = new FanSpeed(3);
    static 2 = new FanSpeed(6);
    static AUTO = new FanSpeed(0);
}

class Power extends Enum {
    constructor(inId, outId) {
        super();
        this.inId = inId;
        this.outId = outId;
    }

    command() {
        return `PW${this.outId}`;
    }

    static ON = new Power('on', '1');
    static OFF = new Power('q', '0');
}

module.exports = {
    Melview,
    Mode,
    FanSpeed,
    Power
}