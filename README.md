# 图片 & 视频转为 ASCII

## 核心实现

1）上传视频，得到视频文件

2）通过 canvas 获取视频每一帧的图片，通过 drawImage 绘制到 canvas 上

3）通过 canvas 的 getImageData 获取图片的像素点数据

4）通过像素点数据，得到图像宽度，高度，根据宽度，高度计算图片的灰度值，

5）根据灰度值计算函数，得到对应的 ascii 字符

6）将获取到的 ascii 字符添加到 div 中显示

## 部署到 Cloudflare Workers

项目采用 Cloudflare 当前推荐的 Workers Static Assets 方案，而不是已废弃的 Workers Sites。Next.js 会先静态导出到 `out/`，Wrangler 再将该目录作为静态资源部署。

### 首次部署

先登录 Cloudflare：

```bash
pnpm exec wrangler login
```

然后构建并部署：

```bash
pnpm run cf:deploy
```

部署成功后会得到一个 `*.workers.dev` 地址。`wrangler.jsonc` 中的 `name` 会作为 Worker 名称，需确保在 Cloudflare 账户中唯一；也可以将它改成自己的项目名称。

### 本地预览 Cloudflare 生产环境

```bash
pnpm run cf:dev
```

该命令会先生成 `out/`，再使用 Wrangler 启动本地 Workers Static Assets 服务。

### Git 自动部署

如果使用 Cloudflare Workers Builds，连接 Git 仓库后设置：

- Build command：`pnpm build`
- Deploy command：`pnpm exec wrangler deploy`
- Root directory：项目根目录
- Environment variable：`NODE_VERSION=22`

也可以在 GitHub Actions 等 CI 中执行 `pnpm run cf:deploy`。CI 需要通过 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 登录 Wrangler。

### 本地检查生产构建

```bash
pnpm install
pnpm build
pnpm start:static
```

然后访问 `http://localhost:3003`。

### 注意事项

- 本项目的图片和视频转换在浏览器中通过 `canvas` 完成，不需要 Cloudflare Functions 或数据库。
- 不要使用链接页面中的 `site.bucket` 和 `@cloudflare/kv-asset-handler`，那是已经废弃的 Workers Sites 方案。
- 不要把 `output` 配置为 `standalone`，它生成的是 Node.js 服务端部署产物；当前项目需要 `output: 'export'` 生成 `out/`。
- 本项目的图片和视频转换在浏览器中通过 `canvas` 完成，不需要 Worker 代码、数据库或 Cloudflare Functions。
