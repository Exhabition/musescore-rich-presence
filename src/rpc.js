const wi = require("@arcsine/win-info");
const fp = require("find-process");
const path = require("path");
const fs = require("fs");
const { Client } = require("discord-rpc");

const EventLogger = require("node-windows").EventLogger;
const terminalArgs = process.argv.slice(2);
const logger = terminalArgs[0] === "--is-service" ? new EventLogger("MuseScore | Discord Presence") : console;

const SUPPORTED_APPS = ["MuseScore.exe", "MuseScore2.exe", "MuseScore3.exe", "MuseScore4.exe"];

class MuseScoreClient {
	constructor() {
		this.discordClient = new Client({ transport: "ipc" });

		this.discordClient.once("ready", () => {
			logger.info("✓ Online and ready to rock!");
			this.update();
			this.timeInterval = setInterval(() => {
				this.update();
			}, 15000);
		});

		this.discordClient.login({ clientId: "577645453429047314" });

		this.states = [];
		this.stateIndex = 0;
        this.noAppsRunningLogged = false;
	}

	async init() {
		const apps = await fp("name", "MuseScore");
		this.app = apps.find((app) => SUPPORTED_APPS.includes(app.name));
	}

	refreshSheetInfo() {
		const currDir = path.join(this.window.owner.path, "../../ScoreInfo.json");
		if (fs.existsSync(currDir)) {
			try {
				const curr = JSON.parse(fs.readFileSync(currDir));
				this.sheetInfo = curr;
				if (this.sheetInfo.scoreName != this.lastfile) {
					this.start = new Date();
					this.lastfile = this.sheetInfo.scoreName;
                    this.states = [];
                    this.stateIndex = 0;
				}
			} catch (error) {
				logger.error(`X Unable to read ScoreInfo.json! Is the file corrupt? (${currDir})`);
				logger.error(error);
			}
		} else {
			logger.error(
				`X Whoops! I wasn't able to find the ScoreInfo.json. Did you install the CurrentScoreInfo MuseScore plugin?
                (${currDir})`
			);
		}
	}

	async update() {
		if (!this.app || !this.window || !this.sheetInfo) {
			await this.init();

			if (!this.app) {
                if (this.noAppsRunningLogged) return;
                else {
                    this.noAppsRunningLogged = true;
                    return logger.info("No MuseScore apps running. (waiting until an app is run)");
                }
			}
		}
        this.noAppsRunningLogged = false;

		if (this.app) {
			try {
				this.window = await wi.getByPid(this.app.pid);
			} catch (error) {
				logger.error(error);
			}
		}

		if (!this.window) {
			return logger.error("Failed to get window info.");
		}

		this.refreshSheetInfo();
		if (!this.sheetInfo) {
			return logger.info("No sheetinfo available.");
		}

		const appName = this.app.name;
		// TODO fix this stuff
		const largeImageKey =
			appName === "MuseScore3.exe"
				? "musescore3-square"
				: appName === "MuseScore4.exe"
				? "musescore4-square"
				: "musescore-square";
		const smallImageKey =
			appName === "MuseScore3.exe"
				? "musescore3-circle"
				: appName === "MuseScore4.exe"
				? "musescore4-circle"
				: "musescore-circle";
		const appTitle =
			appName === "MuseScore3.exe" ? "MuseScore 3" : appName === "MuseScore4.exe" ? "MuseScore 4" : "MuseScore";

		if (this.sheetInfo) {
            const states = this.states;
            if (states.length < 1) {
                if (this.sheetInfo.title) states.push(`Title: ${this.sheetInfo.title}`);
                if (this.sheetInfo.subtitle) states.push(`Subtitle: ${this.sheetInfo.subtitle}`);
                if (this.sheetInfo.composer) states.push(`Composer: ${this.sheetInfo.composer}`);
    
                states.push(`Contains ${this.sheetInfo.nmeasures} Measures`);
                states.push(`Contains ${this.sheetInfo.npages} Pages`);
                states.push(`Contains ${this.sheetInfo.ntracks} Tracks`);
            }

			this.discordClient.setActivity({
				details: `Editing ${this.sheetInfo.scoreName}`,
				state: this.states[this.stateIndex],
				startTimestamp: this.start,
				largeImageKey: largeImageKey,
				smallImageKey: smallImageKey,
				largeImageText: appTitle,
				smallImageText: `Contains ${this.sheetInfo.nmeasures} Measures`
			});

            this.stateIndex += 1;
			if (this.stateIndex >= states.length) this.stateIndex = 0;
		}
	}
}

new MuseScoreClient();

process.on("unhandledRejection", logger.error);
