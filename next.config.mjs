/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'github.com'
			}
		]
	}
};

export default nextConfig;
