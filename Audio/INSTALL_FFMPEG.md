# FFmpeg 安装指南

## Windows 安装步骤

### 方法 1: 使用 Scoop (推荐)
1. 安装 Scoop (如果还没有):
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```

2. 使用 Scoop 安装 FFmpeg:
   ```powershell
   scoop install ffmpeg
   ```

### 方法 2: 手动安装
1. 下载 FFmpeg:
   - 访问: https://www.gyan.dev/ffmpeg/builds/
   - 下载 `ffmpeg-release-essentials.zip`

2. 解压文件:
   - 解压到 `C:\ffmpeg` (或其他位置)

3. 添加到系统 PATH:
   - 右键点击"此电脑" -> "属性"
   - 点击"高级系统设置"
   - 点击"环境变量"
   - 在"系统变量"中找到"Path"，点击"编辑"
   - 点击"新建"，添加: `C:\ffmpeg\bin`
   - 点击"确定"保存所有窗口

4. 验证安装:
   ```powershell
   ffmpeg -version
   ```

### 方法 3: 使用 Chocolatey
```powershell
choco install ffmpeg
```

## 重启终端
安装完成后，**必须关闭并重新打开终端/PowerShell**，让 PATH 环境变量生效。

## 验证安装
运行以下命令确认 FFmpeg 已正确安装:
```powershell
ffmpeg -version
```

应该看到类似输出:
```
ffmpeg version 6.x.x Copyright (c) 2000-2024 the FFmpeg developers
...
```
