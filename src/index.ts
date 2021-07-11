import WebTorrent, { TorrentOptions, Torrent } from "webtorrent";
import axios from "axios";

declare module "webtorrent" {
	export interface Torrent {
		urlList: string[];
	}
}

class TorrentURL {
	private client: WebTorrent.Instance = new WebTorrent();

	constructor(private indexURL = "https://index.torrent-url.tk") {
		axios.defaults.baseURL = this.indexURL;
	}

	fetch(url: string): Promise<Response> {
		return new Promise((resolve, reject) => {
			const torrent: Torrent | undefined = this.client.torrents.find(
				({ urlList }) => urlList.some(item => item === url)
			);
			if (torrent) {
				if (torrent.done) {
					torrent.files[0].getBlob((error, blob) => {
						if (error) reject(error);
						else if (blob) resolve(new Response(blob));
						else reject();
					});
				} else {
					torrent.on("done", () => {
						torrent.files[0].getBlob((error, blob) => {
							if (error) reject(error);
							else if (blob) resolve(new Response(blob));
							else reject();
						});
					});
				}
			} else {
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
							});
						});
					})
					.on("error", () => {
						fetch(url)
							.then(response => {
								resolve(response);

								response.blob().then(blob => {
									this.client.seed(
										<File>blob,
										<TorrentOptions>{
											name: "webtorrent-url-fetch",
											urlList: [url]
										},
										torrent => {
											this.registerTorrent(url, torrent.torrentFile);
											console.log(torrent);
										}
									);
								});
							})
							.catch(reject);
					});
			}
		});
	}

	private registerTorrent(url: string, torrent: Buffer) {
		axios.post("/", { url, torrent });
	}
}

export = TorrentURL;
