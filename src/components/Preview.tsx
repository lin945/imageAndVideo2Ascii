import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { isMobile } from '@/lib/utils';
import { FlipHorizontal, Pause, Play, RefreshCw, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

interface PreviewProps {
	file: File;
	previewUrl: string;
}

export function Preview({ file, previewUrl }: PreviewProps) {
	console.log(previewUrl);

	const isVideo = file?.type?.startsWith('video/');
	// 视频元素
	const videoRef = useRef<HTMLVideoElement>(null);
	// canvas 元素
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// 内容元素
	const txtRef = useRef<HTMLPreElement>(null);
	// 字符分辨率（列数x行数）
	const [charWidth, setCharWidth] = useState(isVideo ? 80 : 100);
	const [charHeight, setCharHeight] = useState(isVideo ? 60 : 80);
	// 帧间隔（毫秒），值越小帧率越高
	const [frameInterval, setFrameInterval] = useState(20);
	// 是否展示视频
	const [showVideo, setShowVideo] = useState(true);
	// ASCII 文本
	const [asciiText, setAsciiText] = useState('');
	// 多帧数据（用于视频导出）
	const [frames, setFrames] = useState<string[]>([]);
	// 定时器
	const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
	// ascii 内容 ref
	const imageRef = useRef<HTMLImageElement>(null);
	// 视频是否真正播放中
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);

	// 添加新的状态控制是否更新 ASCII
	const [isUpdating, setIsUpdating] = useState(true);

	// ASCII字符映射函数
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

	// 计算灰度值
	const getGray = (r: number, g: number, b: number): number => {
		return 0.299 * r + 0.578 * g + 0.114 * b;
	};

	// 视频转换为ASCII
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const convert: any = async () => {
		console.log(1);

		// 如果暂停了就不更新
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
			// 创建新的图片对象并等待加载
			const img = new Image();
			const calculateContainerSize = async () => {
				await new Promise((resolve) => setTimeout(resolve, 700)); // 等待dom元素渲染
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
				// 设置canvas尺寸为计算后的尺寸
				canvas.width = width;
				canvas.height = height;
				ctx.drawImage(img, 0, 0, width, height);

				// 获取图片数据并处理
				const imgData = ctx.getImageData(0, 0, width, height);
				const imgDataArr = imgData.data;
				const imgDataWidth = imgData.width;
				const imgDataHeight = imgData.height;

				// 根据目标字符分辨率计算采样步长
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
			return; // 提前返回，避免执行后续视频相关的代码
		}

		const imgData = ctx.getImageData(0, 0, width, height);
		const imgDataArr = imgData.data;
		const imgDataWidth = imgData.width;
		const imgDataHeight = imgData.height;

		// 根据目标字符分辨率计算采样步长
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
		// 将当前帧添加到frames数组（视频导出用）
		if (isVideo) {
			setFrames((prev) => [...prev, html]);
		}
	};

	// 处理图片和视频的效果
	useEffect(() => {
		if (!isVideo) {
			// 对于图片，直接调用一次转换
			convert();
		} else {
			// 对于视频，设置定时器
			if (intervalIdRef.current) {
				clearInterval(intervalIdRef.current);
			}
			// 只有在更新状态为 true 时才设置定时器
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
	}, [
		file,
		previewUrl,
		charWidth,
		charHeight,
		isUpdating,
		isVideoPlaying,
		frameInterval
	]);
	const togglePlay = async () => {
		if (videoRef.current) {
			if (videoRef.current.paused) {
				videoRef.current.play();
				setIsUpdating(true); // 播放时开启更新
				setIsVideoPlaying(true);
			} else {
				videoRef.current.pause();
				setIsUpdating(false); // 暂停时关闭更新
				setIsVideoPlaying(false);
			}
		}
	};

	const restart = () => {
		if (!videoRef.current) return;
		videoRef.current.currentTime = 0;
		videoRef.current.play();
		setIsUpdating(true); // 重启时开启更新
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

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>预览</CardTitle>
				<CardDescription>调整和预览 ASCII 艺术效果</CardDescription>
				<div className="flex items-center gap-4">
					<Button onClick={() => setShowVideo(!showVideo)} variant="outline">
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
						<div className="flex items-center gap-2">
							<Button variant="outline" size="icon" onClick={togglePlay}>
								{isVideoPlaying ? (
									<Pause className="h-4 w-4" />
								) : (
									<Play className="h-4 w-4" />
								)}
							</Button>
							<Button variant="outline" size="icon" onClick={restart}>
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
							<span className="text-xs text-muted-foreground">
								已采集 {frames.length} 帧
							</span>
						</div>
					)}
					<div className="flex flex-1 items-center gap-4">
						<span className="text-sm">字符分辨率</span>
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
							className="w-16 px-2 py-1 text-sm border rounded"
						/>
						<span className="text-sm">x</span>
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
							className="w-16 px-2 py-1 text-sm border rounded"
						/>
						<span className="text-xs text-muted-foreground">
							字符 (共{charWidth * charHeight}个)
						</span>
					</div>
					{isVideo && (
						<div className="flex flex-1 items-center gap-4">
							<span className="text-sm">帧间隔</span>
							<Slider
								value={[frameInterval]}
								onValueChange={(values) => setFrameInterval(values[0])}
								min={10}
								max={100}
								step={10}
								className="w-[150px]"
							/>
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
								className="w-16 px-2 py-1 text-sm border rounded"
							/>
							<span className="text-sm">ms</span>
							<span className="text-xs text-muted-foreground">
								(~{Math.round(1000 / frameInterval)} FPS)
							</span>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<ResizablePrimitive.PanelGroup
					direction="horizontal"
					className="h-[600px] max-h-[80vh] rounded-lg border relative"
				>
					<ResizablePrimitive.Panel
						defaultSize={50}
						minSize={30}
						className={`p-3 ${showVideo && !isMobile() ? '' : 'absolute left-[-10000px] top-[-10000px] w-1/2 h-auto'}`}
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
						className="p-3 content"
					>
						<pre
							ref={txtRef}
							onClick={togglePlay}
							className=" leading-none whitespace-pre cursor-pointer text-[4px]"
						>
							{asciiText}
							{!asciiText && (
								<span className="!text-[16px]"> 等待生成 ASCII 内容...</span>
							)}
						</pre>
					</ResizablePrimitive.Panel>
				</ResizablePrimitive.PanelGroup>
			</CardContent>
			{/* canvas 元素，用来生成 ASCII */}
			<canvas ref={canvasRef} className="hidden" />
		</Card>
	);
}
