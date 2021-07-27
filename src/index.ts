import WebTorrent, { TorrentOptions, Torrent } from "webtorrent";
import ParseTorrent from "parse-torrent";
import TorrentIndex from "./TorrentIndex";

declare module "webtorrent" {
	interface Torrent {
		urlList: string[];
	}
}

class WebTorrentFetch {
	private client: WebTorrent.Instance = new WebTorrent();
	private createTorrent: boolean;
	private autoFetch: boolean;
	private index: TorrentIndex;
	private readonly NEW_TORRENT_NAME: string = "webtorrent-fetch";

	constructor({
		indexURL = "https://index.webtorrent-fetch.tk",
		autoFetch = true, // fetch automatically the url when not exist in index
		createTorrent = true // create torrent when url is not exist in index (this is only works if the autoFetch is enabled)
	} = {}) {
		this.createTorrent = createTorrent;
		this.autoFetch = autoFetch;
		this.index = new TorrentIndex(indexURL);
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
				this.index
					.getTorrent(url)
					.then(torrentFile => {
						this.client.add(torrentFile, torrent => {
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
						});
					})
					.catch(() => {
						if (this.autoFetch) {
							fetch(url)
								.then(response => {
									resolve(response);

									if (this.createTorrent) {
										response.blob().then(async blob => {
											const opts: { name: string; urlList?: string[] } = {
												name: this.NEW_TORRENT_NAME
											};

											await this.testWebSeed(url).then(() => {
												opts.urlList = [url];
											});

											this.client.seed(
												<File>blob,
												<TorrentOptions>opts,
												torrent => {
													this.index.createTorrent(torrent.torrentFile);
													console.log(torrent);
												}
											);
										});
									}
								})
								.catch(reject);
						} else reject();
					});
			}
		});
	}

	// seed exist data from cache, localStorage, indexedDB etc...
	async seed(url: string, data: Blob): Promise<void> {
		const opts: { name: string; urlList?: string[] } = {
			name: this.NEW_TORRENT_NAME
		};

		await this.testWebSeed(url).then(() => {
			opts.urlList = [url];
		});

		this.client.seed(<File>data, <TorrentOptions>opts, torrent => {
			// check the torrent is registered in index
			this.index.createTorrent(torrent.torrentFile);
		});
	}

	private testWebSeed(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			fetch(url, { method: "HEAD", headers: { range: "bytes=0-127" } })
				.then(response => {
					if (
						response.status === 206
						/* && response.headers.get("content-length") === 128 */
					) {
						resolve();
					} else reject();
				})
				.catch(reject);
		});
	}
}

export = WebTorrentFetch;
