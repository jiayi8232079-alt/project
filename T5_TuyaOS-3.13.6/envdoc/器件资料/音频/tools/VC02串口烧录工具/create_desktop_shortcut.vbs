Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\VC02-Flash-Tool.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "c:\000_OPC\器件资料\音频\tools\VC02串口烧录工具\启动VC02串口烧录工具.bat"
oLink.WorkingDirectory = "c:\000_OPC\器件资料\音频\tools\VC02串口烧录工具"
oLink.Description = "VC-02 UniOneUpdateTool"
oLink.Save
