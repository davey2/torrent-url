import axios, { AxiosInstance, AxiosResponse } from "axios";
import ParseTorrent from "parse-torrent";

export default class TorrentIndex {
	private http: AxiosInstance;

	constructor(indexURL: string) {
		this.http = axios.create({
			baseURL: indexURL
		});
	}

	createTorrent(buffer: Buffer): void {
		this.http.post("/", ParseTorrent(buffer));
	}

	getTorrent(url: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			this.http
				.get(`/${url}`, {
					transformResponse(response) {
						try {
							return JSON.parse(response, (key, value) => {
								if (value.type && value.type === "Buffer")
									return Buffer.from(value.data);
								else return value;
							});
						} catch (error) {
							return response;
						}
					}
				})
				.then(response => {
					// TypeError: parsed.created.getTime is not a function
					response.data.created = new Date(response.data.created);
					resolve(ParseTorrent.toTorrentFile(response.data));
				})
				.catch(reject);
		});
	}
}
