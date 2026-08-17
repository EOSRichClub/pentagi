/*! PentAGI zh-CN overlay - runtime UI translation */
(function () {
  if (window.__PENTAGI_ZH__) return;
  window.__PENTAGI_ZH__ = true;
  document.documentElement.lang = 'zh-CN';

  const dict = {
    // auth
    'Sign in': '登录',
    'Sign In': '登录',
    'Login': '登录',
    'Log in': '登录',
    'Logout': '退出登录',
    'Log out': '退出登录',
    'Email': '邮箱',
    'Password': '密码',
    'Current password': '当前密码',
    'New password': '新密码',
    'Confirm password': '确认密码',
    'Change password': '修改密码',
    'Forgot password': '忘记密码',
    'Welcome': '欢迎',
    'Welcome back': '欢迎回来',
    // nav
    'Dashboard': '仪表盘',
    'Flows': '任务流',
    'Templates': '模板',
    'Settings': '设置',
    'Providers': '模型提供商',
    'Prompts': '提示词',
    'API Tokens': 'API 令牌',
    'Usage': '用量',
    'Knowledge': '知识库',
    // knowledge pages (list, create, edit, dialogs, and editor toolbar)
    'Knowledges': '知识库',
    'New Knowledge': '新建知识文档',
    'New knowledge': '新建知识文档',
    'New knowledge — PentAGI': '新建知识库 — PentAGI',
    'Knowledges — PentAGI': '知识库 — PentAGI',
    'Knowledge — PentAGI': '知识库详情 — PentAGI',
    'Create a new knowledge document': '新建知识文档',
    'Add an entry to the vector knowledge base': '向向量知识库添加一条内容',
    'Edit knowledge document': '编辑知识文档',
    'Edits to content or metadata will trigger re-embedding': '修改内容或元数据后会自动重新生成向量',
    'Document type': '文档类型',
    'Select type': '选择文档类型',
    'Answer type': '答案类型',
    'Select answer type': '选择答案类型',
    'Guide type': '指南类型',
    'Select guide type': '选择指南类型',
    'Code language': '代码语言',
    'e.g. python, go, typescript': '例如：Python、Go、TypeScript',
    'No matching language': '没有匹配的语言',
    'Question': '标题或问题',
    'Short title or question this document answers': '输入简短标题或该文档要回答的问题',
    'Description (optional)': '描述（选填）',
    'Optional short description': '输入简短描述（选填）',
    'Content': '正文内容',
    'Knowledge content (will be embedded into the vector store)': '输入知识内容（将写入向量库）',
    'Write something …': '请输入内容…',
    'Anonymize': '内容脱敏',
    'Anonymizing...': '正在脱敏…',
    'Content anonymized': '内容已脱敏',
    'No sensitive data detected': '未检测到敏感信息',
    'Anonymizer returned no result': '脱敏服务未返回结果',
    'Failed to anonymize content': '内容脱敏失败',
    'Failed to save knowledge document': '保存知识文档失败',
    'Knowledge actions': '知识文档操作',
    'Knowledge question': '知识标题或问题',
    'Double-click to rename': '双击即可重命名',
    'Knowledge renamed successfully': '知识文档已重命名',
    'knowledge document': '知识文档',
    'knowledge documents': '知识文档',
    'Loading knowledges...': '正在加载知识库…',
    'Please wait while we fetch your knowledge documents': '正在获取知识文档，请稍候',
    'No knowledge documents yet': '暂无知识文档',
    'Create your first knowledge document to enrich the vector store': '新建第一条知识文档，为向量库补充内容',
    'Filter knowledge documents...': '筛选知识文档…',
    'Search knowledge documents': '搜索知识文档',
    'Semantic search...': '语义搜索…',
    'Preview': '内容预览',
    'Flags': '来源',
    'Open menu': '打开菜单',
    'Rename': '重命名',
    'flow #': '任务流 #',
    'task #': '任务 #',
    'subtask #': '子任务 #',
    'chunk': '分块',
    'Question is required': '请输入标题或问题',
    'Content is required': '请输入正文内容',
    'Answer type is required': '请选择答案类型',
    'Guide type is required': '请选择指南类型',
    'Code language is required': '请输入代码语言',
    'Unsaved changes': '尚未保存的更改',
    'You have unsaved changes on this page. Would you like to save them before leaving?': '此页面有尚未保存的更改，离开前是否保存？',
    'Discard': '放弃更改',
    'Bold': '加粗',
    'Bold (Ctrl+B)': '加粗（Ctrl+B）',
    'Italic': '斜体',
    'Italic (Ctrl+I)': '斜体（Ctrl+I）',
    'Strikethrough': '删除线',
    'Inline code': '行内代码',
    'Heading 1': '一级标题',
    'Heading 2': '二级标题',
    'Heading 3': '三级标题',
    'Bullet list': '项目符号列表',
    'Ordered list': '编号列表',
    'Blockquote': '引用',
    'Code block': '代码块',
    'Link': '链接',
    'Insert link': '插入链接',
    'Horizontal rule': '分隔线',
    'Undo': '撤销',
    'Undo (Ctrl+Z)': '撤销（Ctrl+Z）',
    'Redo': '重做',
    'Redo (Ctrl+Shift+Z)': '重做（Ctrl+Shift+Z）',
    'Suggestions': '候选项',    'Resources': '资源库',
    'Users': '用户',
    'Profile': '个人资料',
    'Theme': '主题',
    'Light': '浅色',
    'Dark': '深色',
    'System': '系统',
    // flows
    'New Flow': '新建任务',
    'Create Flow': '创建任务',
    'Automation': '自动化',
    'Assistant': '助手',
    'Use Agents': '使用智能体',
    'Provider': '提供商',
    'Select provider': '选择提供商',
    'Start': '开始',
    'Stop': '停止',
    'Finish': '完成',
    'Cancel': '取消',
    'Delete': '删除',
    'Edit': '编辑',
    'Save': '保存',
    'Create': '创建',
    'Update': '更新',
    'Copy': '复制',
    'Download': '下载',
    'Upload': '上传',
    'Search': '搜索',
    'Filter': '筛选',
    'Refresh': '刷新',
    'Back': '返回',
    'Next': '下一步',
    'Previous': '上一步',
    'Close': '关闭',
    'Confirm': '确认',
    'Submit': '提交',
    'Reset': '重置',
    'Report': '报告',
    'Open report': '打开报告',
    'Copy report': '复制报告',
    'Download Markdown': '下载 Markdown',
    'Download PDF': '下载 PDF',
    'Status': '状态',
    'Active': '进行中',
    'Running': '运行中',
    'Completed': '已完成',
    'Failed': '失败',
    'Waiting': '等待中',
    'Pending': '待处理',
    'Tasks': '任务',
    'Subtasks': '子任务',
    'Messages': '消息',
    'Terminal': '终端',
    'Tools': '工具',
    'Screenshots': '截图',
    'Files': '文件',
    'Graph': '关系图',
    'Title': '标题',
    'Description': '描述',
    'Name': '名称',
    'Actions': '操作',
    'Created': '创建时间',
    'Updated': '更新时间',
    'No data': '暂无数据',
    'Loading': '加载中',
    'Loading...': '加载中…',
    'Success': '成功',
    'Error': '错误',
    'Warning': '警告',
    'Info': '信息',
    // settings
    'Settings -> Providers': '设置 → 模型提供商',

    'Manage language model providers': '管理语言模型提供商',
    'Create Provider': '创建提供商',
    'Update Provider': '更新提供商',
    'New Provider': '新建提供商',
    'Edit Provider': '编辑提供商',
    'Provider Settings': '提供商设置',
    'Update provider settings and configuration': '更新提供商设置和配置',
    'Configure a new language model provider': '配置新的语言模型提供商',
    'Agent Configurations': '智能体配置',
    'Configure settings for each agent type': '配置每类智能体的参数',
    'Provider Test Results': '提供商测试结果',
    'Testing...': '测试中…',
    'Saving...': '保存中…',
    'Rows per page': '每页行数',
    'Downloads': '下载',
    'Searcher': '搜索器',
    'Searches': '搜索',
    'Vector Store': '向量库',
    'Flow actions': '任务流操作',
    'Open menu': '打开菜单',
    'Toggle Sidebar': '切换侧边栏',
    'Filter providers...': '筛选提供商…',
    'Select or enter model name': '选择或输入模型名',
    'Max Tokens': '最大 Token 数',
    'Reasoning Config': '推理配置',
    'Reasoning Effort': '推理强度',
    'Reasoning Max Tokens': '推理最大 Token 数',
    'Price Config': '价格配置',
    'Input Price': '输入价格',
    'Output Price': '输出价格',
    'Cache Read Price': '缓存读取价格',
    'Cache Write Price': '缓存写入价格',
    'Create Token': '创建令牌',
    'Revoke': '吊销',
    'Expiration': '过期时间',
    'Model': '模型',
    'Test': '测试',
    'Enabled': '已启用',
    'Disabled': '已禁用',
    'Default': '默认',
    'provider': '提供商',
    'providers': '提供商',
    'choose type': '选择类型',
    'Create provider': '创建提供商',
    'Provider name is required': '提供商名称为必填项',
    'Maximum 50 characters allowed': '最多允许 50 个字符',
    'The type of language model provider': '语言模型提供商类型',
    'A unique name for your provider configuration': '此提供商配置的唯一名称',
    'Columns': '列',
    'First page': '第一页',
    'Last page': '最后一页',
    'Previous page': '上一页',
    'Next page': '下一页',
    'Search in': '搜索',
    'Showing': '显示',
    'Created At': '创建时间',
    'Updated At': '更新时间',
    'Created time': '创建时间',
    'Updated time': '更新时间',
    'Clone': '克隆',
    'Leave': '离开',
    'Stay': '留下',
    'Discard changes?': '放弃更改？',
    'You have unsaved changes. Are you sure you want to leave without saving?': '你有未保存的更改，确定不保存就离开吗？',
    'Error loading provider data': '加载提供商数据失败',
    'Please wait while we fetch provider configuration': '正在获取提供商配置，请稍候',
    'Loading provider data...': '正在加载提供商数据…',
    'An error occurred while saving': '保存时发生错误',
    'An error occurred while testing': '测试时发生错误',
    'An error occurred while deleting': '删除时发生错误',
    'No provider found.': '未找到提供商。',
    'Search type...': '搜索类型…',
    'No type found.': '未找到类型。',
    'Use': '使用',
    'as custom': '作为自定义',
    'model': '模型',
    'No model found.': '未找到模型。',
    'Search model...': '搜索模型…',
    'not selected': '未选择',
    'Price per 1M input tokens': '每 100 万输入 token 价格',
    'Price per 1M output tokens': '每 100 万输出 token 价格',
    'Price per 1M cached read tokens': '每 100 万缓存读取 token 价格',
    'Price per 1M cache write tokens': '每 100 万缓存写入 token 价格',
    'Simple Json': '简单 JSON',
    'Primary Agent': '主智能体',
    'Adviser': '顾问',
    'Coder': '代码智能体',
    'Enricher': '增强器',
    'Generator': '生成器',
    'Installer': '安装器',
    'Pentester': '渗透测试智能体',
    'Refiner': '精炼器',
    'Reflector': '反思器',
    'tests passed': '项测试通过',
    'Local Downloads': '本地下载',
    'API Token': 'API 令牌',
    'Prompt': '提示词',

    // settings pages - broad coverage
    'Settings Overview': '设置总览',
    'General Settings': '通用设置',
    'Account Settings': '账号设置',
    'Security Settings': '安全设置',
    'System Settings': '系统设置',
    'User Settings': '用户设置',
    'Prompt Settings': '提示词设置',
    'Token Settings': '令牌设置',
    'Download Settings': '下载设置',
    'Manage settings': '管理设置',
    'Manage providers': '管理模型提供商',
    'Manage prompts': '管理提示词',
    'Manage API tokens': '管理 API 令牌',
    'Manage downloads': '管理下载',
    'API keys': 'API 密钥',
    'API tokens': 'API 令牌',
    'API Token Created': 'API 令牌已创建',
    'No API tokens configured': '尚未配置 API 令牌',
    'Create your first API token to access PentAGI programmatically': '创建第一个 API 令牌，用于通过程序访问 PentAGI',
    'Please wait while we fetch your API tokens': '正在获取你的 API 令牌，请稍候',
    'Loading tokens...': '正在加载令牌…',
    'Error loading tokens': '加载令牌失败',
    'Filter tokens...': '筛选令牌…',
    'Token name (optional)': '令牌名称（可选）',
    'Token ID': '令牌 ID',
    'Copy Token': '复制令牌',
    'Copy token ID': '复制令牌 ID',
    'Copy Token ID': '复制令牌 ID',
    'Copy this token now. You won\'t be able to see it again for security reasons.': '请现在复制此令牌。出于安全原因，之后将无法再次查看。',
    'Token copied to clipboard': '令牌已复制到剪贴板',
    'Token ID copied to clipboard': '令牌 ID 已复制到剪贴板',
    'Failed to copy token to clipboard': '复制令牌失败',
    'Failed to copy token ID to clipboard': '复制令牌 ID 失败',
    'Expires': '过期时间',
    'expires': '过期',
    'expired': '已过期',
    'Never expires': '永不过期',
    'Revoked': '已吊销',
    'revoked': '已吊销',
    'Active token': '有效令牌',
    'Delete token': '删除令牌',
    'Revoke token': '吊销令牌',
    'Are you sure you want to revoke this token?': '确定要吊销此令牌吗？',
    'Downloads will be saved under': '下载内容将保存到',
    'No folder selected': '未选择文件夹',
    'Browser default (system Downloads folder)': '浏览器默认目录（系统下载文件夹）',
    'Ask each time / Browser default': '每次询问 / 使用浏览器默认目录',
    'Local Downloads': '本地下载',
    'Download location': '下载位置',
    'Select folder': '选择文件夹',
    'Choose folder': '选择文件夹',
    'Browse files': '浏览文件',
    'Browse': '浏览',
    'Open folder': '打开文件夹',
    'Save downloads to': '下载保存到',
    'Agent Prompts': '智能体提示词',
    'Prompt templates': '提示词模板',
    'Prompt templates could not be loaded': '提示词模板加载失败',
    'No prompts available': '暂无可用提示词',
    'Please wait while we fetch your prompt templates': '正在获取提示词模板，请稍候',
    'Loading prompts...': '正在加载提示词…',
    'Error loading prompts': '加载提示词失败',
    'Prompt not found': '未找到提示词',
    'Error loading prompt data': '加载提示词数据失败',
    'Loading prompt data...': '正在加载提示词数据…',
    'Please wait while we fetch prompt information': '正在获取提示词信息，请稍候',
    'Configure the prompt for this tool': '配置此工具的提示词',
    'System Prompt': '系统提示词',
    'Human Prompt': '用户提示词',
    'Tool Name': '工具名称',
    'Agent Name': '智能体名称',
    'system': '系统',
    'human': '用户',
    'agent': '智能体',
    'template': '模板',
    'default': '默认',
    'Default': '默认',
    'Valid Template': '模板有效',
    'Validation Error': '校验错误',
    'An error occurred while validating': '校验时发生错误',
    'An error occurred while resetting': '重置时发生错误',
    'Reset Prompt': '重置提示词',
    'Reset All': '全部重置',
    'Reset Human': '重置用户提示词',
    'Reset System': '重置系统提示词',
    'Resetting...': '正在重置…',
    'Are you sure you want to reset this prompt to its default value? This action cannot be undone.': '确定要把此提示词恢复为默认值吗？此操作不可撤销。',
    'Are you sure you want to reset this prompt to its default value': '确定要把此提示词恢复为默认值吗',
    'This will revert it to the default template and cannot be undone.': '这会恢复为默认模板，且不可撤销。',
    'Are you sure you want to reset all prompts for': '确定要重置以下对象的全部提示词吗：',
    'Are you sure you want to reset the human prompt for': '确定要重置以下对象的用户提示词吗：',
    'Are you sure you want to reset the system prompt for': '确定要重置以下对象的系统提示词吗：',
    'Enter the system prompt template...': '输入系统提示词模板…',
    'Enter the human prompt template...': '输入用户提示词模板…',
    'Enter the tool template...': '输入工具模板…',
    'System template is required': '系统模板为必填项',
    'Human template is required': '用户模板为必填项',
    'Human prompt type not found': '未找到用户提示词类型',
    'prompt template.': '提示词模板。',
    'prompt': '提示词',
    'No providers configured': '尚未配置模型提供商',
    'No agent configuration available': '暂无智能体配置',
    'Get started by adding your first language model provider': '添加第一个语言模型提供商即可开始使用',
    'Loading providers...': '正在加载提供商…',
    'Error loading providers': '加载提供商失败',
    'Error deleting provider': '删除提供商失败',
    'Add Provider': '添加提供商',
    'Create provider — choose type': '创建提供商 — 选择类型',
    'Enter provider name': '输入提供商名称',
    'Please fix the following validation errors:': '请修复以下校验错误：',
    'Frequency Penalty': '频率惩罚',
    'Presence Penalty': '存在惩罚',
    'Repetition Penalty': '重复惩罚',
    'Temperature': '温度',
    'Top P': 'Top P',
    'Top K': 'Top K',
    'Min Length': '最小长度',
    'Max Length': '最大长度',
    'Medium': '中等',
    'Low': '低',
    'High': '高',
    'Max': '最大',
    'Thinking': '思考',
    'thinking': '思考',
    'Agent Configuration': '智能体配置',
    'No users configured': '尚未配置用户',
    'Loading users...': '正在加载用户…',
    'Error loading users': '加载用户失败',
    'Create User': '创建用户',
    'Update User': '更新用户',
    'Delete User': '删除用户',
    'User name': '用户名',
    'Username': '用户名',
    'Full name': '姓名',
    'Roles': '角色',
    'Role name': '角色名称',
    'Access Control': '访问控制',
    'Permission': '权限',
    'Create Role': '创建角色',
    'Update Role': '更新角色',
    'Delete Role': '删除角色',
    'No roles configured': '尚未配置角色',
    'Personal access tokens': '个人访问令牌',
    'Access token': '访问令牌',
    'Secret': '密钥',
    'Key': '密钥',
    'Public Key': '公钥',
    'Private Key': '私钥',
    'Last used': '上次使用',
    'Last Used': '上次使用',
    'Created by': '创建者',
    'Created By': '创建者',
    'Updated by': '更新者',
    'Updated By': '更新者',
    'Search users...': '搜索用户…',
    'Search prompts...': '搜索提示词…',
    'Search downloads...': '搜索下载…',
    'Search templates...': '搜索模板…',
    'Search resources...': '搜索资源…',
    'Search knowledge...': '搜索知识库…',
    'Filter prompts...': '筛选提示词…',
    'Filter users...': '筛选用户…',
    'Filter downloads...': '筛选下载…',
    'Filter templates...': '筛选模板…',
    'Filter resources...': '筛选资源…',
    'Filter knowledge...': '筛选知识库…',
    'No tokens found.': '未找到令牌。',
    'No prompts found.': '未找到提示词。',
    'No users found.': '未找到用户。',
    'No downloads found.': '未找到下载。',
    'No templates found.': '未找到模板。',
    'No resources found.': '未找到资源。',
    'No knowledge found.': '未找到知识。',
    'Back to Templates': '返回模板',
    'New template': '新建模板',
    'Create template': '创建模板',
    'Update template': '更新模板',
    'Delete template': '删除模板',
    'Template name': '模板名称',
    'Template description': '模板描述',
    'Content': '内容',
    'File name': '文件名',
    'File size': '文件大小',
    'File type': '文件类型',
    'Updated': '更新时间',
    'Copy ID': '复制 ID',
    'Copy name': '复制名称',
    'Open': '打开',
    'Open in new tab': '在新标签页打开',
    'Select all': '全选',
    'Deselect all': '取消全选',
    'All Columns': '全部列',
    'Toggle columns': '切换列',
    'Sort ascending': '升序排序',
    'Sort descending': '降序排序',
    'Hide column': '隐藏列',
    'Clear filters': '清除筛选',
    'Apply': '应用',
    'Apply changes': '应用更改',
    'Unsaved changes': '未保存的更改',
    'Save changes': '保存更改',
    'No results.': '没有结果。',
    'No items found.': '未找到项目。',
    '(unnamed)': '（未命名）',
    'create-new': '新建',


    // settings visible leftovers
    'Back to App': '返回应用',
    '返回 to App': '返回应用',
    'Tools': '工具',
    'tools': '工具',
    'Agents': '智能体',
    'agents': '智能体',
    'Prompt templates for system tools and utilities': '系统工具和实用工具的提示词模板',
    '提示词模板 for 系统 tools and utilities': '系统工具和实用工具的提示词模板',
    'Manage system and custom prompt templates': '管理系统和自定义提示词模板',
    'Manage 系统 and custom 提示词 模板s': '管理系统和自定义提示词模板',
    'System and user prompts for AI agents': 'AI 智能体的系统提示词和用户提示词',
    '跟随系统 and 用户 提示词s for AI 智能体s': 'AI 智能体的系统提示词和用户提示词',
    '系统 and 用户 提示词s for AI 智能体s': 'AI 智能体的系统提示词和用户提示词',
    'Tool Prompts': '工具提示词',
    'Tool 提示词': '工具提示词',
    'Choose Docker Image': '选择 Docker 镜像',
    'Choose User Language': '选择用户语言',
    'Choose 用户 语言': '选择用户语言',
    'Collect Tool Call Id': '收集工具调用 ID',
    'Detect Tool Call Id Pattern': '检测工具调用 ID 模式',
    'Get Execution Logs': '获取执行日志',
    'Get Flow Description': '获取任务流描述',
    'Get Flow 描述': '获取任务流描述',
    'Get Full Execution Context': '获取完整执行上下文',
    'Get Short Execution Context': '获取简短执行上下文',
    'Get Task Description': '获取任务描述',
    'Get Task 描述': '获取任务描述',
    'Monitor Agent Execution': '监控智能体执行',
    'Plan Agent Task': '规划智能体任务',
    'Tool Call Fixer': '工具调用修复器',
    'Wrap Agent Task': '包装智能体任务',
    'Reporter': '报告器',
    '报告er': '报告器',
    'Memorist': '记忆器',
    'Summarizer': '摘要器',
    'N/A': '不适用',
    'Search tools...': '筛选工具…',
    '筛选 tools...': '筛选工具…',
    'Search agents...': '筛选智能体…',
    '筛选 智能体s...': '筛选智能体…',
    'API tokens for programmatic access': '用于程序化访问的 API 令牌',
    'Manage API tokens for programmatic access': '管理用于程序化访问的 API 令牌',
    '管理 API 令牌 for programmatic access': '管理用于程序化访问的 API 令牌',
    'GraphQL Playground': 'GraphQL 调试台',
    '关系图QL Playground': 'GraphQL 调试台',
    'Swagger UI': 'Swagger 接口文档',
    'Download behaviour': '下载行为',
    '下载 behaviour': '下载行为',
    'Applies to flow files, resource library downloads, and exported reports.': '适用于任务流文件、资源库下载和导出的报告。',
    'Choose local folder…': '选择本地文件夹…',
    'Chosen folder:': '已选文件夹：',
    'Clear': '清除',
    'Mode': '模式',
    'Browser default': '浏览器默认',
    'system Downloads folder': '系统下载文件夹',


    '系统 and 用户 提示词s for AI 智能体': 'AI 智能体的系统提示词和用户提示词',
    '系统 and 用户 提示词s for AI 智能体s': 'AI 智能体的系统提示词和用户提示词',
    'GraphQL 调试台': 'GraphQL 调试台',
    '关系图QL 调试台': 'GraphQL 调试台',


    'Control where files from flows / resources are saved on this computer. Because of browser security, the page cannot write to an arbitrary path string — you choose a folder once, and we reuse that permission.': '控制任务流和资源库文件在这台电脑上的保存位置。由于浏览器安全限制，页面不能直接写入任意路径；你只需要选择一次文件夹，之后会复用该授权。',
    'Control where files from 任务流 / 资源库 are saved on this computer. Because of browser security, the page cannot write to an arbitrary path string — you choose a folder once, and we reuse that permission.': '控制任务流和资源库文件在这台电脑上的保存位置。由于浏览器安全限制，页面不能直接写入任意路径；你只需要选择一次文件夹，之后会复用该授权。',
    'Control where files from 任务流 / 资源库 are saved on this computer. Because of b行er security, the page cannot write to an arbitrary path string — you choose a folder once, and we reuse that permission.': '控制任务流和资源库文件在这台电脑上的保存位置。由于浏览器安全限制，页面不能直接写入任意路径；你只需要选择一次文件夹，之后会复用该授权。',
    'Because of browser security': '由于浏览器安全限制',
    'Because of b行er security': '由于浏览器安全限制',
    'the page cannot write to an arbitrary path string': '页面不能直接写入任意路径',
    'you choose a folder once, and we reuse that permission': '你只需要选择一次文件夹，之后会复用该授权',
    'on this computer': '在这台电脑上',
    'files from flows / resources': '任务流和资源库文件',
    'files from 任务流 / 资源库': '任务流和资源库文件',
    'browser security': '浏览器安全限制',
    'b行er security': '浏览器安全限制',


    'Ask for location every time': '每次询问保存位置',
    'Always save to a chosen folder': '始终保存到已选择的文件夹',
    'Ask for location every time / Browser default': '每次询问保存位置 / 浏览器默认',
    'Always save to selected folder': '始终保存到已选择的文件夹',
    'Always save to a selected folder': '始终保存到已选择的文件夹',


    'type': '类型',
    'status': '状态',
    'name': '名称',
    'createdAt': '创建时间',
    'updatedAt': '更新时间',
    'Not selected': '未选择',
    'Simple Test': '简单测试',
    'Simple测试': '简单测试',
    'Simple JSON Test': '简单 JSON 测试',
    'Simple Json Test': '简单 JSON 测试',
    '简单 JSON测试': '简单 JSON 测试',
    'OpenAI': 'OpenAI',
    '打开AI': 'OpenAI',
    '打开AI打开AI': 'OpenAI',
    'Custom': '自定义',
    'CustomCustom': '自定义',


    // dashboard / analytics
    'Analytics': '数据分析',
    'Cost Over Time': '费用趋势',
    'Token Usage Over Time': 'Token 用量趋势',
    'Token 用量 Over Time': 'Token 用量趋势',
    'Tool Calls Over Time': '工具调用趋势',
    'Flow Activity Over Time': '任务流活动趋势',
    '任务流 Activity Over Time': '任务流活动趋势',
    'Flow Execution Details': '任务流执行详情',
    'Flow Execution 详情': '任务流执行详情',
    'Execution time and tool calls breakdown per flow': '按任务流统计执行时间和工具调用次数',
    'LLM spending per day. May stay near zero when using local engines — this is expected.': '每日 LLM 花费。使用本地引擎时可能接近 0，这是正常现象。',
    'Number of tool executions per day': '每日工具执行次数',
    'Flows, tasks, and subtasks created per day': '每日创建的任务流、任务和子任务数量',
    '任务流, tasks, and subtasks created per day': '每日创建的任务流、任务和子任务数量',
    'Input and output tokens processed daily': '每日处理的输入与输出 token 数',
    '输入 and output tokens processed daily': '每日处理的输入与输出 token 数',
    'Week': '周',
    'Month': '月',
    'Quarter': '季度',
    'Today': '今天',
    'Yesterday': '昨天',
    'Last 7 days': '最近 7 天',
    'Last 30 days': '最近 30 天',
    'Last 90 days': '最近 90 天',
    'Aug': '8月',
    'Jan': '1月',
    'Feb': '2月',
    'Mar': '3月',
    'Apr': '4月',
    'May': '5月',
    'Jun': '6月',
    'Jul': '7月',
    'Sep': '9月',
    'Oct': '10月',
    'Nov': '11月',
    'Dec': '12月',
    'task': '任务',
    'tasks': '任务',
    'assistant': '助手',
    'assistants': '助手',
    'subtask': '子任务',
    'subtasks': '子任务',
    'tool call': '工具调用',
    'tool calls': '工具调用',
    'Upload file': '上传文件',
    '上传 file': '上传文件',
    'Knowledge bases': '知识库',
    '知识库s': '知识库',
    'breadcrumb': '面包屑导航',


    'Total duration': '总耗时',
    'Duration': '耗时',
    'Cache In': '缓存输入',
    'Cache Out': '缓存输出',
    'Usage In': '输入用量',
    'Usage Out': '输出用量',
    'Cost In': '输入费用',
    'Cost Out': '输出费用',
    'Flow': '任务流',
    'Subtask': '子任务',
    'Task': '任务',
    'Agent': '智能体',
    'Provider': '提供商',
    'Function': '函数',
    'Function name': '函数名',
    'Tool executions': '工具执行',
    'Total tool calls': '工具调用总数',
    'Total tokens': 'Token 总数',
    'Total cost': '总费用',
    'No analytics data': '暂无分析数据',
    'No usage data': '暂无用量数据',
    'No execution data': '暂无执行数据',
    'No flows found': '未找到任务流',
    'Loading analytics...': '正在加载数据分析…',
    'Loading dashboard...': '正在加载仪表盘…',
    'Error loading dashboard': '加载仪表盘失败',
    'Error loading analytics': '加载数据分析失败',


    // dashboard complete labels
    'Total Flows': '任务流总数',
    'Flows': '任务流',
    'Tasks': '任务',
    'Subtasks': '子任务',
    'Tool': '工具',
    'Tool Calls': '工具调用',
    'Tool Calls by Function': '按函数统计工具调用',
    'Usage by Agent Type': '按智能体类型统计用量',
    'Usage by Model': '按模型统计用量',
    'Usage by Provider': '按提供商统计用量',
    'Total LLM spending across all providers': '所有提供商的 LLM 总花费',
    'Avg Duration': '平均耗时',
    'Total Duration': '总耗时',
    'Flow Execution Details': '任务流执行详情',
    'Flows Activity Over Time': '任务流活动趋势',
    'Total Flow Count': '任务流总数',
    'Total Task Count': '任务总数',
    'Total Subtask Count': '子任务总数',
    'Execution Details': '执行详情',
    'Spending': '花费',
    'Tokens': 'Token',
    'Models': '模型',
    'Providers': '模型提供商',
    'Functions': '函数',
    'Calls': '调用次数',
    'Average': '平均值',
    'Total': '总计',
    'Created per day': '每日创建数量',
    'Per day': '每日',
    'No chart data': '暂无图表数据',


    'Show thinking': '显示思考过程',
    'Show 思考': '显示思考过程',
    'Show details': '显示详情',
    'Hide details': '隐藏详情',
    'Search messages...': '搜索消息…',
    '搜索 messages...': '搜索消息…',
    'Open flows list': '打开任务流列表',
    '打开 flows list': '打开任务流列表',
    'Toggle favorite': '切换收藏',

    // misc
    'Home': '首页',
    'About': '关于',
    'Documentation': '文档',
    'Language': '语言',
    'Admin': '管理员',
    'User': '用户',
    'Role': '角色',
    'Permissions': '权限',
    'Are you sure?': '确定吗？',
    'This action cannot be undone.': '此操作不可撤销。',
    'No results found': '未找到结果',
    'Try again': '重试',
    'Copy to clipboard': '复制到剪贴板',
    'Copied': '已复制',
    'Upload files': '上传文件',
    'Attach resources': '附加资源',
    'Pull from container': '从容器拉取',
    'Container is not running': '容器未运行',
    'Select template': '选择模板',
    'Templates': '模板',
    'New template': '新建模板',
    'Input': '输入',
    'Output': '输出',
    'Result': '结果',
    'Details': '详情',
    'Overview': '总览',
    'Configuration': '配置',
    'Advanced': '高级',
    'Basic': '基础',
    'Optional': '可选',
    'Required': '必填',
    'Yes': '是',
    'No': '否',
    'All': '全部',
    'None': '无',
    'More': '更多',
    'Less': '收起',
    'Show more': '显示更多',
    'Show less': '收起',
    'Page': '页',
    'of': '/',
    'rows': '行',
    'Rows per page': '每页行数',
    'Type a message': '输入消息',
    'Send message': '发送消息',
    'Describe your task': '描述你的任务',
    'Describe the target and objective': '描述目标与测试目标',
    'Fully autonomous penetration testing': '全自动渗透测试',
    'Interactive assistant mode': '交互式助手模式',
  };

  const exactOnly = {
    'Type': '类型',
    '例如：Python、Go、TypeScript': '例如：Python、Go、TypeScript',
    'manual': '手动添加',
    'answer': '答案',
    'guide': '指南',
    'code': '代码',
    'other': '其他',
    'tool': '工具',
    'vulnerability': '漏洞',
    'configure': '配置',
    'development': '开发',
    'install': '安装',
    'pentest': '渗透测试',
    'use': '使用',
  };  // longest keys first for better replace
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);

  function translateText(text) {
    if (!text) return text;
    let t = text;
    // exact
    if (exactOnly[t]) return exactOnly[t];
    if (dict[t]) return dict[t];
    // trim exact
    const trimmed = t.trim();
    if (exactOnly[trimmed]) return t.replace(trimmed, exactOnly[trimmed]);
    if (dict[trimmed]) return t.replace(trimmed, dict[trimmed]);
    // phrase replace; avoid tiny tokens like No/of inside larger words (Notifications, Profile, etc.)
    for (const k of keys) {
      if (k.length < 3) continue;
      if (t.includes(k)) t = t.split(k).join(dict[k]);
    }
    if (/^Control where .*任务流和资源库文件.*saved.*这台电脑/.test(t)) {
      return '控制任务流和资源库文件在这台电脑上的保存位置。由于浏览器安全限制，页面不能直接写入任意路径；你只需要选择一次文件夹，之后会复用该授权。';
    }
    t = t.replace(/(\d+)\s+assistants?/g, '$1 个助手')
         .replace(/(\d+)\s+subtasks?/g, '$1 个子任务')
         .replace(/(\d+)\s+tasks?/g, '$1 个任务')
         .replace(/Aug\s+(\d+)/g, '8月$1日')
         .replace(/(\d+)h\s+(\d+)m/g, '$1小时 $2分钟')
         .replace(/(\d+)m\s+(\d+)s/g, '$1分钟 $2秒')
         .replace(/(\d+)h/g, '$1小时')
         .replace(/(\d+)m/g, '$1分钟')
         .replace(/(\d+)s/g, '$1秒')
         .replace(/Total duration:\s*/g, '总耗时：')
         .replace(/Flow #(\d+)/g, '任务流 #$1')
         .replace(/Task #(\d+)/g, '任务 #$1')
         .replace(/Subtask #(\d+)/g, '子任务 #$1')
         .replace(/知识库s/g, '知识库')
         .replace(/上传 file/g, '上传文件')
         .replace(/任务流, tasks, and subtasks created per day/g, '每日创建的任务流、任务和子任务数量')
         .replace(/输入 and output tokens processed daily/g, '每日处理的输入与输出 token 数')
         .replace(/系统 and 用户 提示词s for AI 智能体/g, 'AI 智能体的系统提示词和用户提示词')
         .replace(/3月iaDB/g, 'MariaDB')
         .replace(/Show 思考/g, '显示思考过程')
         .replace(/Show details/g, '显示详情')
         .replace(/Hide details/g, '隐藏详情')
         .replace(/打开 flows list/g, '打开任务流列表')
         .replace(/Toggle favorite/g, '切换收藏')
         .replace(/搜索 messages/g, '搜索消息')
         .replace(/筛选 任务/g, '筛选任务')
         .replace(/(.+?) must be (\d+) characters or fewer/g, '$1不能超过 $2 个字符');
    return t;
  }

  function walk(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'CODE' || node.tagName === 'PRE') return;
    // attributes: translate these before skipping form fields, otherwise placeholders stay English.
    ['placeholder', 'title', 'aria-label', 'aria-description', 'data-placeholder'].forEach((attr) => {
      if (node.hasAttribute && node.hasAttribute(attr)) {
        const v = node.getAttribute(attr);
        const nv = translateText(v);
        if (nv !== v) node.setAttribute(attr, nv);
      }
    });
    if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT' || node.isContentEditable || node.getAttribute('contenteditable') === 'true' || (node.closest && node.closest('.ProseMirror, [contenteditable="true"], [translate="no"]'))) return;
    // text nodes
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const v = child.nodeValue;
        if (!v || !v.trim()) continue;
        const nv = translateText(v);
        if (nv !== v) child.nodeValue = nv;
      } else if (child.nodeType === 1) {
        walk(child);
      }
    }
  }

  function run() {
    try {
      walk(document.body);
      document.querySelectorAll('.ProseMirror [data-placeholder]').forEach((element) => {
        const value = element.getAttribute('data-placeholder');
        const translated = translateText(value);
        if (translated !== value) element.setAttribute('data-placeholder', translated);
      });
      const translatedTitle = translateText(document.title);
      if (translatedTitle !== document.title) document.title = translatedTitle;
    } catch (e) {}
  }

  const obs = new MutationObserver(() => {
    if (window.__zh_raf) return;
    window.__zh_raf = requestAnimationFrame(() => {
      window.__zh_raf = null;
      run();
    });
  });

  function boot() {
    if (!document.getElementById('pentagi-zh-knowledge-style')) {
      const style = document.createElement('style');
      style.id = 'pentagi-zh-knowledge-style';
      style.textContent = '.ProseMirror p.is-editor-empty:first-child::before { content: "输入知识内容（将写入向量库）" !important; }';
      document.head.appendChild(style);
    }
    run();
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // badge
    if (!document.getElementById('pentagi-zh-badge')) {
      const b = document.createElement('div');
      b.id = 'pentagi-zh-badge';
      b.textContent = '中文界面';
      b.title = 'PentAGI 运行时汉化层（上游官方主要为英文 UI）';
      b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#0f766e;color:#fff;padding:6px 10px;border-radius:999px;font:12px/1.2 sans-serif;opacity:.85;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.25)';
      document.body.appendChild(b);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  function providerIdFromPath() {
    const m = location.pathname.match(/\/settings\/providers\/(\d+)/);
    return m ? m[1] : null;
  }

  function styleInput(el) {
    el.style.cssText = 'width:100%;height:36px;border:1px solid hsl(214.3 31.8% 91.4%);border-radius:6px;background:transparent;padding:6px 10px;font-size:14px;outline:none;';
    return el;
  }

  async function fetchProviderSecret(id) {
    const r = await fetch('/codex/provider-secrets?id=' + encodeURIComponent(id), { credentials: 'include', cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || '读取密钥配置失败');
    return data.provider;
  }

  async function saveProviderSecret(id, apiKey, serverUrl, reasoningEffort) {
    const r = await fetch('/codex/provider-secrets', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, api_key: apiKey, server_url: serverUrl, reasoning_effort: reasoningEffort })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || '保存密钥配置失败');
    return data.provider;
  }

  async function mountProviderSecretEditor() {
    const id = providerIdFromPath();
    if (!id) return;
    if (document.getElementById('codex-provider-secret-editor')) return;
    const form = document.getElementById('provider-form');
    if (!form) return;
    const nameInput = form.querySelector('input[name="name"]');
    if (!nameInput) return;
    const nameWrap = nameInput.closest('div');
    if (!nameWrap || !nameWrap.parentElement) return;

    const box = document.createElement('section');
    box.id = 'codex-provider-secret-editor';
    box.style.cssText = 'border:1px solid hsl(214.3 31.8% 91.4%);border-radius:8px;padding:14px;margin-top:4px;background:rgba(15,118,110,.04);display:flex;flex-direction:column;gap:10px;';
    box.innerHTML = '<div style="font-weight:600;font-size:15px;">模型密钥配置</div><div style="font-size:12px;color:#64748b;line-height:1.5;">这里保存当前 Provider 专属的 API Key 和接口地址。Key 不会完整回显；留空保存表示保留原 Key。</div>';

    const serverLabel = document.createElement('label');
    serverLabel.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;';
    serverLabel.textContent = '接口地址（Base URL）';
    const serverInput = styleInput(document.createElement('input'));
    serverInput.placeholder = 'https://open.bigmodel.cn/api/coding/paas/v4';
    serverLabel.appendChild(serverInput);

    const keyLabel = document.createElement('label');
    keyLabel.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;';
    keyLabel.textContent = 'API Key';
    const keyInput = styleInput(document.createElement('input'));
    keyInput.type = 'password';
    keyInput.placeholder = '留空则不修改现有 Key';
    keyLabel.appendChild(keyInput);

    const reasoningLabel = document.createElement('label');
    reasoningLabel.style.cssText = 'display:none;flex-direction:column;gap:6px;font-size:13px;font-weight:500;';
    reasoningLabel.textContent = 'DeepSeek 推理强度';
    const reasoningSelect = styleInput(document.createElement('select'));
    reasoningSelect.innerHTML = '<option value="">关闭/默认</option><option value="high">High（高）</option><option value="max">Max（最大）</option>';
    reasoningLabel.appendChild(reasoningSelect);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = '保存密钥配置';
    saveBtn.style.cssText = 'height:34px;border-radius:6px;border:0;background:#0f766e;color:white;padding:0 12px;font-size:13px;cursor:pointer;';
    const status = document.createElement('span');
    status.style.cssText = 'font-size:12px;color:#64748b;';
    row.append(saveBtn,status);

    box.append(serverLabel,keyLabel,reasoningLabel,row);
    nameWrap.parentElement.insertBefore(box, nameWrap.nextSibling);

    try {
      const p = await fetchProviderSecret(id);
      serverInput.value = p.server_url || '';
      if (p.type === 'deepseek') {
        reasoningLabel.style.display = 'flex';
        reasoningSelect.value = p.reasoning_effort || '';
      }
      status.textContent = p.has_api_key ? ('已保存 Key：' + (p.api_key_masked || '***')) : '尚未保存专属 Key，将使用环境变量。';
    } catch (e) {
      status.textContent = e.message || '读取失败';
      status.style.color = '#dc2626';
    }

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true; saveBtn.textContent = '保存中…'; status.style.color = '#64748b'; status.textContent = '';
      try {
        const p = await saveProviderSecret(id, keyInput.value.trim(), serverInput.value.trim(), reasoningLabel.style.display === 'none' ? undefined : reasoningSelect.value);
        keyInput.value = '';
        status.style.color = '#0f766e';
        if (p.type === 'deepseek') reasoningSelect.value = p.reasoning_effort || '';
        status.textContent = '已保存。当前 Key：' + (p.api_key_masked || '***') + (p.reasoning_effort ? ('；推理强度：' + p.reasoning_effort) : '');
      } catch (e) {
        status.style.color = '#dc2626';
        status.textContent = e.message || '保存失败';
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = '保存密钥配置';
      }
    });
  }


  function hideBuiltinDeepSeekDuplicate() {
    const exactDeepSeek = (text) => {
      const t = (text || '').trim();
      return /^(deepseek|DeepSeek)$/i.test(t);
    };
    document.querySelectorAll('option').forEach((opt) => {
      if (exactDeepSeek(opt.textContent) || exactDeepSeek(opt.value)) opt.hidden = true;
    });
    document.querySelectorAll('[role="option"], [cmdk-item], [data-radix-collection-item], button, a').forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (exactDeepSeek(text)) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
    document.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.children).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim());
      if (cells.length && exactDeepSeek(cells[0]) && !cells.join(' ').includes('v4 Flash')) {
        tr.style.display = 'none';
        tr.setAttribute('aria-hidden', 'true');
      }
    });
  }

  const codexMountObserver = new MutationObserver(() => {
    if (window.__codex_provider_secret_raf) return;
    window.__codex_provider_secret_raf = requestAnimationFrame(() => {
      window.__codex_provider_secret_raf = null;
      mountProviderSecretEditor().catch(() => {});
      hideBuiltinDeepSeekDuplicate();
    });
  });
  codexMountObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('pointerup', () => setTimeout(run, 80), true);
  document.addEventListener('keyup', () => setTimeout(run, 80), true);
  setInterval(() => { mountProviderSecretEditor().catch(() => {}); hideBuiltinDeepSeekDuplicate(); run(); }, 1200);

})();
