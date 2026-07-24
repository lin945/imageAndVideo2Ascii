import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { FlipHorizontal, Pause, Play, RefreshCw, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

interface PreviewProps {
	file: File;
	previewUrl: string;
}

const formatSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDuration = (seconds: number): string => {
	if (seconds <= 0) return '--';
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	if (mins > 0) return `${mins}分${secs}秒`;
	return `${secs}秒`;
};

export function Preview({ file, previewUrl }: PreviewProps) {
	const isVideo = file?.type?.startsWith('video/');
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const txtRef = useRef<HTMLPreElement>(null);
	const imageRef = useRef<HTMLImageElement>(null);
	const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

	const [charWidth, setCharWidth] = useState(isVideo ? 80 : 100);
	const [charHeight, setCharHeight] = useState(isVideo ? 60 : 80);
	const [frameInterval, setFrameInterval] = useState(20);
	const [showVideo, setShowVideo] = useState(true);
	const [asciiText, setAsciiText] = useState('');
	const [frames, setFrames] = useState<string[]>([]);
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);
	const [isUpdating, setIsUpdating] = useState(true);
	const [videoProgress, setVideoProgress] = useState(0);
	const [videoDuration, setVideoDuration] = useState(0);

	const toText = (g: number): string => {
		if (g <= 30) return '#';
		if (g <= 60) return '&';
		if (g <= 120) return '$';
		if (g <= 150) return '*';
		if (g <= 180) return 'o';
		if (g <= 210) return '!';
		if (g <= 240) return ';';
		return ' ';
	};

	const getGray = (r: number, g: number, b: number): number => {
		return 0.299 * r + 0.578 * g + 0.114 * b;
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const convert: any = async () => {
		if (!isUpdating) return;
		const video = videoRef.current;
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		let width, height;

		if (isVideo && video) {
			width = video.clientWidth;
			height = video.clientHeight;

			canvas.width = width;
			canvas.height = height;
			ctx.drawImage(video, 0, 0, width, height);
		} else {
			const img = new Image();
			const calculateContainerSize = async () => {
				await new Promise((resolve) => setTimeout(resolve, 700));
				const containerWidth =
					imageRef.current?.clientWidth || imageRef.current?.width;
				const containerHeight =
					imageRef.current?.clientHeight || imageRef.current?.height;
				if (!containerHeight || !containerWidth)
					return { width: 400, height: 400 };
				return { width: containerWidth, height: containerHeight };
			};

			const { width, height } = await calculateContainerSize();

			img.crossOrigin = 'Anonymous';

			img.onload = () => {
				canvas.width = width;
				canvas.height = height;
				ctx.drawImage(img, 0, 0, width, height);

				const imgData = ctx.getImageData(0, 0, width, height);
				const imgDataArr = imgData.data;
				const imgDataWidth = imgData.width;
				const imgDataHeight = imgData.height;

				const stepX = imgDataWidth / charWidth;
				const stepY = imgDataHeight / charHeight;

				const lines: string[] = [];
				for (let row = 0; row < charHeight; row++) {
					const h = Math.floor(row * stepY);
					let p = '';
					for (let col = 0; col < charWidth; col++) {
						const w = Math.floor(col * stepX);
						const index = (w + imgDataWidth * h) * 4;
						const r = imgDataArr[index + 0];
						const g = imgDataArr[index + 1];
						const b = imgDataArr[index + 2];
						const gray = getGray(r, g, b);
						p += toText(gray);
					}
					lines.push(p);
				}
				setAsciiText(lines.join('\n'));
			};
			img.src = previewUrl;
			return;
		}

		const imgData = ctx.getImageData(0, 0, width, height);
		const imgDataArr = imgData.data;
		const imgDataWidth = imgData.width;
		const imgDataHeight = imgData.height;

		const stepX = imgDataWidth / charWidth;
		const stepY = imgDataHeight / charHeight;

		const lines: string[] = [];
		for (let row = 0; row < charHeight; row++) {
			const h = Math.floor(row * stepY);
			let p = '';
			for (let col = 0; col < charWidth; col++) {
				const w = Math.floor(col * stepX);
				const index = (w + imgDataWidth * h) * 4;
				const r = imgDataArr[index + 0];
				const g = imgDataArr[index + 1];
				const b = imgDataArr[index + 2];
				const gray = getGray(r, g, b);
				p += toText(gray);
			}
			lines.push(p);
		}
		const html = lines.join('\n');

		setAsciiText(html);
		if (isVideo) {
			setFrames((prev) => [...prev, html]);
		}
	};

	useEffect(() => {
		if (!isVideo) {
			convert();
		} else {
			if (intervalIdRef.current) {
				clearInterval(intervalIdRef.current);
			}
			if (isUpdating) {
				if (isVideoPlaying) {
					intervalIdRef.current = setInterval(convert, frameInterval);
				} else {
					setTimeout(() => {
						convert();
					}, 1000);
				}
			}
		}

		return () => {
			if (intervalIdRef.current) {
				clearInterval(intervalIdRef.current);
			}
		};
	}, [file, previewUrl, charWidth, charHeight, isUpdating, isVideoPlaying, frameInterval, isVideo]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !isVideo) return;

		const handleTimeUpdate = () => {
			if (video.duration > 0) {
				setVideoProgress((video.currentTime / video.duration) * 100);
			}
		};

		const handleLoadedMetadata = () => {
			setVideoDuration(video.duration);
		};

		video.addEventListener('timeupdate', handleTimeUpdate);
		video.addEventListener('loadedmetadata', handleLoadedMetadata);

		return () => {
			video.removeEventListener('timeupdate', handleTimeUpdate);
			video.removeEventListener('loadedmetadata', handleLoadedMetadata);
		};
	}, [isVideo]);

	const togglePlay = async () => {
		if (videoRef.current) {
			if (videoRef.current.paused) {
				videoRef.current.play();
				setIsUpdating(true);
				setIsVideoPlaying(true);
			} else {
				videoRef.current.pause();
				setIsUpdating(false);
				setIsVideoPlaying(false);
			}
		}
	};

	const restart = () => {
		if (!videoRef.current) return;
		videoRef.current.currentTime = 0;
		videoRef.current.play();
		setIsUpdating(true);
		setFrames([]);
	};

	const exportJson = () => {
		const fps = Math.round(1000 / frameInterval);
		const data = {
			fps,
			width: charWidth,
			height: charHeight,
			frames: isVideo ? frames : [asciiText]
		};
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${file.name.replace(/\.[^.]+$/, '')}_ascii.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const clearFrames = () => {
		setFrames([]);
	};

	const estimatedTotalFrames = isVideo
		? Math.ceil(videoDuration * (1000 / frameInterval))
		: 1;

	const estimatedJsonBytes = isVideo
		? estimatedTotalFrames * (charWidth * (charHeight + 1) + 2) * 1.3
		: (charWidth * (charHeight + 1) + 2) * 1.3;

	const currentBytes =
		frames.length > 0
			? frames.length * (charWidth * (charHeight + 1) + 2) * 1.3
			: 0;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>配置设置</CardTitle>
					<CardDescription>调整字符分辨率和帧间隔参数</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-3">
						<label className="text-sm font-medium">字符分辨率</label>
						<div className="flex items-center gap-2">
							<input
								type="number"
								value={charWidth}
								onChange={(e) => {
									const val = parseInt(e.target.value);
									if (!isNaN(val) && val >= 10 && val <= 500) {
										setCharWidth(val);
									}
								}}
								min={10}
								max={500}
								className="w-20 px-3 py-1.5 text-sm border rounded-md"
							/>
							<span className="text-sm text-muted-foreground">×</span>
							<input
								type="number"
								value={charHeight}
								onChange={(e) => {
									const val = parseInt(e.target.value);
									if (!isNaN(val) && val >= 10 && val <= 500) {
										setCharHeight(val);
									}
								}}
								min={10}
								max={500}
								className="w-20 px-3 py-1.5 text-sm border rounded-md"
							/>
							<span className="text-xs text-muted-foreground">
								共 {charWidth * charHeight} 个字符
							</span>
						</div>
					</div>

					{isVideo && (
						<div className="space-y-3">
							<label className="text-sm font-medium">帧间隔</label>
							<Slider
								value={[frameInterval]}
								onValueChange={(values) => setFrameInterval(values[0])}
								min={10}
								max={100}
								step={10}
								className="w-full max-w-[300px]"
							/>
							<div className="flex items-center gap-2">
								<input
									type="number"
									value={frameInterval}
									onChange={(e) => {
										const val = parseInt(e.target.value);
										if (!isNaN(val) && val >= 10 && val <= 100) {
											setFrameInterval(val);
										}
									}}
									min={10}
									max={100}
									className="w-20 px-3 py-1.5 text-sm border rounded-md"
								/>
								<span className="text-sm">ms</span>
								<span className="text-xs text-muted-foreground">
									(~{Math.round(1000 / frameInterval)} FPS)
								</span>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardContent className="pt-6 space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								{isVideo ? '视频进度' : '转换进度'}
							</span>
							<span className="font-medium tabular-nums">
								{isVideo
									? `${Math.round(videoProgress)}%`
									: asciiText
										? '100%'
										: '0%'}
							</span>
						</div>
						<Progress
							value={isVideo ? videoProgress : asciiText ? 100 : 0}
							className="h-2"
						/>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">预估JSON大小</span>
							<p className="text-sm font-medium tabular-nums">
								{formatSize(estimatedJsonBytes)}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">预估时长</span>
							<p className="text-sm font-medium tabular-nums">
								{isVideo ? formatDuration(videoDuration) : '即时'}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">已采集 / 总帧数</span>
							<p className="text-sm font-medium tabular-nums">
								{frames.length}
								{isVideo && (
									<span className="text-muted-foreground">
										{' '}
										/ {estimatedTotalFrames}
									</span>
								)}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">当前大小</span>
							<p className="text-sm font-medium tabular-nums">
								{formatSize(currentBytes)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>预览</CardTitle>
					<CardDescription>实时预览 ASCII 艺术效果</CardDescription>
					<div className="flex items-center gap-2 flex-wrap">
						<Button
							onClick={() => setShowVideo(!showVideo)}
							variant="outline"
							size="sm"
						>
							{showVideo ? '隐藏' : '显示'}原始内容
						</Button>
						{!isVideo && (
							<Button
								variant="outline"
								size="icon"
								onClick={exportJson}
								title="导出JSON"
							>
								<Download className="h-4 w-4" />
							</Button>
						)}
						{isVideo && (
							<>
								<Button
									variant="outline"
									size="icon"
									onClick={togglePlay}
								>
									{isVideoPlaying ? (
										<Pause className="h-4 w-4" />
									) : (
										<Play className="h-4 w-4" />
									)}
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={restart}
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={clearFrames}
									title="清空帧数据"
								>
									清空
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={exportJson}
									title="导出JSON"
								>
									<Download className="h-4 w-4" />
								</Button>
							</>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="lg:hidden flex flex-col gap-4">
						{showVideo && (
							<div className="h-[250px] sm:h-[350px] rounded-lg border overflow-hidden bg-black/5">
								{isVideo ? (
									<video
										crossOrigin="anonymous"
										ref={videoRef}
										src={previewUrl}
										onClick={togglePlay}
										className="h-full w-full object-contain"
										controls={false}
									/>
								) : (
									<img
										ref={imageRef}
										src={previewUrl}
										alt="Original"
										className="h-full w-full object-contain"
									/>
								)}
							</div>
						)}
						<div className="h-[250px] sm:h-[350px] overflow-auto rounded-lg border bg-muted/10 p-2">
							<pre
								ref={txtRef}
								onClick={togglePlay}
								className="leading-none whitespace-pre cursor-pointer text-[4px]"
							>
								{asciiText}
								{!asciiText && (
									<span className="!text-[16px]">
										等待生成 ASCII 内容...
									</span>
								)}
							</pre>
						</div>
					</div>

					<div className="hidden lg:block">
						<ResizablePrimitive.PanelGroup
							direction="horizontal"
							className="h-[600px] max-h-[80vh] rounded-lg border relative"
						>
							<ResizablePrimitive.Panel
								defaultSize={50}
								minSize={30}
								className={`p-3 ${showVideo ? '' : 'absolute left-[-10000px] top-[-10000px] w-1/2 h-auto'}`}
							>
								<div className="h-full overflow-hidden rounded-md">
									{isVideo ? (
										<video
											crossOrigin="anonymous"
											ref={videoRef}
											src={previewUrl}
											onClick={togglePlay}
											className="h-full w-full object-contain"
											controls={false}
										/>
									) : (
										<img
											ref={imageRef}
											src={previewUrl}
											alt="Original"
											className="h-full w-full object-contain"
										/>
									)}
								</div>
							</ResizablePrimitive.Panel>

							<ResizablePrimitive.PanelResizeHandle className="w-2 bg-muted/50 hover:bg-muted/80">
								<div className="flex h-full w-full items-center justify-center">
									<FlipHorizontal className="h-4 w-4" />
								</div>
							</ResizablePrimitive.PanelResizeHandle>

							<ResizablePrimitive.Panel
								defaultSize={50}
								minSize={30}
								className="p-3"
							>
								<pre
									ref={txtRef}
									onClick={togglePlay}
									className="leading-none whitespace-pre cursor-pointer text-[4px]"
								>
									{asciiText}
									{!asciiText && (
										<span className="!text-[16px]">
											等待生成 ASCII 内容...
										</span>
									)}
								</pre>
							</ResizablePrimitive.Panel>
						</ResizablePrimitive.PanelGroup>
					</div>
				</CardContent>
			</Card>
			<canvas ref={canvasRef} className="hidden" />
		</div>
	);
}