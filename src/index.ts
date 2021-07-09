import WebTorrent, { TorrentOptions } from "webtorrent";
import axios from "axios";

class TorrentURL {
	private client: WebTorrent.Instance = new WebTorrent();

	constructor(private indexURL = "https://index.torrent-url.tk") {
		axios.defaults.baseURL = this.indexURL;
	}

	fetch(url: string): Promise<Response> {
		return new Promise((resolve, reject) => {
			this.client
				.add(`${this.indexURL}/${url}`, torrent => {
					console.log("torrent added", torrent);

					torrent.on("done", () => {
						console.log("torrent done");
						torrent.files[0].getBlob((error, blob) => {
							if (error) reject(error);
							else if (blob) resolve(new Response(blob));
							else reject();
						});

						torrent.on("noPeers", announceType => {
							console.log("noPeers", announceType);

							// nincs peer a torrenthez
							// ebben az esetben automatikusan a webseedekhez kellene fordulnia
						});
					});
				})
				.on("error", () => {
					// error esetén valószínűleg nem létezik a torrent az indexben
					// sima fetch-el le kell kérdezni az adatokat és elkezdeni seedelni
					// a torrent file adatait beküldeni az indexnek
					// és ellenőrizni, hogy a hash nincs-e már regisztrálva
					// ha regisztrálva van hozzá adjuk az url-t
					// ha nincs akkor felvisszük mint új torrent

					fetch(url)
						.then(response => {
							resolve(response);

							response.blob().then(blob => {
								this.client.seed(
									<File>blob,
									<TorrentOptions>{ name: "webtorrent-url-fetch" },
									torrent => {
										this.registerTorrent(url, torrent.torrentFile);
									}
								);
							});
						})
						.catch(reject);
				});
		});
		/* return new Promise((resolve, reject) => {
			axios
				.get(`/${url}`)
				.then(response => {
					const hash: string = response.data;
					console.log("add torrent...");
					this.client.add(hash, { announce: this.trackers }, torrent => {
						console.log("torrent added");
						torrent.addWebSeed(url);
						torrent.on("done", () => {
							console.log("torrent done");
							torrent.files[0].getBlob((error, blob) => {
								if (error) reject(error);
								else if (blob) resolve(new Response(blob));
								else reject();
							});
						});

						torrent.on("noPeers", () => {
							reject();
						});
					});
				})
				.catch(() => {
					fetch(url).then(response => {
						resolve(response);

						response.blob().then(blob => {
							this.client.seed(<File>blob);
						});
					});
				});
		}); */
	}

	private registerTorrent(url: string, torrent: Buffer) {
		axios.post("/", { url, torrent });
	}
}

export = TorrentURL;
