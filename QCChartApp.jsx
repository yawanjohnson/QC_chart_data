import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Type, ArrowRight, Download, Trash2, X, Move, FileImage,
  Layers, Lock, Unlock, History, RotateCcw, MonitorPlay, ZoomIn, ZoomOut,
  Edit3, Plus, Copy, ChevronLeft, ChevronRight, Save, Search, Database, Folder, FolderPlus
} from 'lucide-react';

const QCChartApp = () => {
  // --- Global State ---
  const [metaData, setMetaData] = useState({
    brand: 'BRAND NAME',
    product: 'Treadmill Model-X',
    date: new Date().toISOString().split('T')[0],
    version: 'V1.0'
  });

  const [viewZoom, setViewZoom] = useState(0.6); // Default smaller zoom for A3
  const [mode, setMode] = useState('move'); // 'move', 'arrow', 'text'
  const [isLoading, setIsLoading] = useState(false);

  // --- Multi-Page State ---
  const [pages, setPages] = useState([{
    id: Date.now(),
    name: 'Page 1',
    mainImage: null,
    mainImagePos: { x: 0, y: 0, scale: 100 },
    isMainImageLocked: false,
    items: [],
    arrows: []
  }]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // --- Library / Assets State ---
  const [assets, setAssets] = useState([]); // Current session uploads
  const [libraryAssets, setLibraryAssets] = useState([]); // Persistent library: { id, src, name, folder }
  const [librarySearch, setLibrarySearch] = useState("");
  const [folders, setFolders] = useState(['TM', 'EP', 'BIKE', 'STRENGTH']);
  const [activeFolder, setActiveFolder] = useState('TM');
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [tab, setTab] = useState('upload'); // 'upload' or 'library'

  // --- Selection & Interaction ---
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Arrow Interaction State
  const [dragArrowStart, setDragArrowStart] = useState(null);
  const [tempArrow, setTempArrow] = useState(null);

  // Arrow Styling Options
  const [arrowSettings, setArrowSettings] = useState({
    width: 2,
    color: '#dc2626',
    style: 'solid' // 'solid' or 'dashed'
  });

  // Export Quality Settings
  const [exportDPI, setExportDPI] = useState(150); // 96, 150, or 300
  const [showExportOptions, setShowExportOptions] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [savedVersions, setSavedVersions] = useState([]);

  const workspaceRef = useRef(null);
  const canvasRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    // Load Libraries
    const loadScript = (src) => new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script'); s.src = src; s.onload = resolve; document.head.appendChild(s);
    });

    const init = async () => {
      await Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
        loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js')
      ]);
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      // Load LocalStorage Data
      try {
        const v = localStorage.getItem('qc_versions');
        if (v) setSavedVersions(JSON.parse(v));

        const lib = localStorage.getItem('qc_asset_library');
        if (lib) setLibraryAssets(JSON.parse(lib));

        const savedFolders = localStorage.getItem('qc_folders');
        if (savedFolders) setFolders(JSON.parse(savedFolders));
      } catch (e) { console.error(e); }
    };
    init();
  }, []);

  // --- Page Management ---
  const activePage = pages[activePageIndex];

  const updatePage = (updates) => {
    setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, ...updates } : p));
  };

  const addPage = () => {
    const newPage = {
      id: Date.now(),
      name: `Page ${pages.length + 1}`,
      mainImage: null,
      mainImagePos: { x: 0, y: 0, scale: 100 },
      isMainImageLocked: false,
      items: [],
      arrows: []
    };
    setPages(prev => [...prev, newPage]);
    setActivePageIndex(pages.length);
  };

  const deletePage = (index, e) => {
    if (e) e.stopPropagation(); // Critical: Prevent switching to the page we are deleting
    if (pages.length <= 1) return alert("至少需要保留一頁");
    if (!confirm("確定刪除此頁面？")) return;

    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    // If we deleted the active page or a page before it, adjust index
    if (index <= activePageIndex) {
      setActivePageIndex(Math.max(0, activePageIndex - 1));
    }
  };

  // --- Asset Library Logic ---
  const saveToLibrary = (asset) => {
    // Check duplicates in current folder context mostly, but globally is safer
    if (libraryAssets.some(a => a.name === asset.name && a.src.length === asset.src.length)) {
      alert("資料庫已有相同檔案");
      return;
    }
    try {
      const assetWithFolder = { ...asset, folder: activeFolder };
      const newLib = [...libraryAssets, assetWithFolder];
      setLibraryAssets(newLib);
      localStorage.setItem('qc_asset_library', JSON.stringify(newLib));
      alert(`已加入資料庫 (${activeFolder})`);
    } catch (e) {
      alert("儲存失敗，可能是檔案太大。");
    }
  };

  const deleteFromLibrary = (id) => {
    if (!confirm("從資料庫刪除？")) return;
    const newLib = libraryAssets.filter(a => a.id !== id);
    setLibraryAssets(newLib);
    localStorage.setItem('qc_asset_library', JSON.stringify(newLib));
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    if (folders.includes(newFolderName)) return alert("資料夾已存在");
    const newFolders = [...folders, newFolderName];
    setFolders(newFolders);
    localStorage.setItem('qc_folders', JSON.stringify(newFolders));
    setActiveFolder(newFolderName);
    setNewFolderName('');
    setShowAddFolder(false);
  };

  // --- Main Image Logic ---
  const handleMainImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updatePage({
          mainImage: e.target.result,
          mainImagePos: { x: 0, y: 0, scale: 100 },
          isMainImageLocked: false
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Asset Upload (PDF/Image) ---
  const processPDF = async (file) => {
    if (!window.pdfjsLib) return null;
    try {
      const ab = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument(ab).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 2 });
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      cvs.height = vp.height; cvs.width = vp.width;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      return cvs.toDataURL('image/png');
    } catch (e) { console.error(e); return null; }
  };

  const handleAssetUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsLoading(true);
    for (const file of files) {
      let src = null;
      if (file.type === 'application/pdf') src = await processPDF(file);
      else if (file.type.startsWith('image/')) {
        src = await new Promise(r => {
          const fr = new FileReader();
          fr.onload = (ev) => r(ev.target.result);
          fr.readAsDataURL(file);
        });
      }
      if (src) setAssets(p => [...p, { id: Date.now() + Math.random(), src, name: file.name, isPdf: file.type === 'application/pdf' }]);
    }
    setIsLoading(false);
  };

  const addToCanvas = (asset) => {
    updatePage({ items: [...activePage.items, { ...asset, canvasId: Date.now(), x: 50, y: 50, width: 150, type: 'image' }] });
  };

  // --- Arrow Logic ---
  const getCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / viewZoom,
      y: (e.clientY - rect.top) / viewZoom
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (mode === 'arrow' && e.target === canvasRef.current) {
      const pt = getCanvasPoint(e);
      setDragArrowStart(pt);
      setTempArrow({ start: pt, end: pt });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (dragArrowStart) {
      const pt = getCanvasPoint(e);
      setTempArrow({ start: dragArrowStart, end: pt });
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragArrowStart && tempArrow) {
      const newArrow = {
        id: Date.now(),
        start: tempArrow.start,
        end: tempArrow.end,
        points: [tempArrow.start, tempArrow.end], // For polyline support
        width: arrowSettings.width,
        color: arrowSettings.color,
        style: arrowSettings.style
      };
      updatePage({ arrows: [...activePage.arrows, newArrow] });
      setDragArrowStart(null);
      setTempArrow(null);
      setMode('move');
    }
  };

  const updateArrow = (id, updates) => {
    updatePage({ arrows: activePage.arrows.map(a => a.id === id ? { ...a, ...updates } : a) });
  };

  const deleteSelected = () => {
    if (selectedType === 'item') {
      updatePage({ items: activePage.items.filter(i => i.canvasId !== selectedId) });
    } else if (selectedType === 'arrow') {
      updatePage({ arrows: activePage.arrows.filter(a => a.id !== selectedId) });
    }
    setSelectedId(null);
    setSelectedType(null);
  };

  // --- Project Save/Load ---
  const saveProject = () => {
    const projectName = prompt("請輸入專案名稱：", `${metaData.brand}_${metaData.product}`);
    if (!projectName) return;

    const project = {
      id: Date.now(),
      name: projectName,
      metaData,
      pages,
      savedAt: new Date().toISOString()
    };

    try {
      const newVersions = [...savedVersions, project];
      setSavedVersions(newVersions);
      localStorage.setItem('qc_versions', JSON.stringify(newVersions));
      alert(`專案 "${projectName}" 已儲存！`);
    } catch (e) {
      alert("儲存失敗，專案可能太大。請減少圖片數量或降低圖片品質。");
    }
  };

  const loadProject = (project) => {
    if (!confirm(`載入專案 "${project.name}"？目前的工作將會被覆蓋。`)) return;
    setMetaData(project.metaData);
    setPages(project.pages);
    setActivePageIndex(0);
    setShowHistory(false);
    alert("專案已載入！");
  };

  const deleteProject = (id) => {
    if (!confirm("確定刪除此專案？")) return;
    const newVersions = savedVersions.filter(v => v.id !== id);
    setSavedVersions(newVersions);
    localStorage.setItem('qc_versions', JSON.stringify(newVersions));
  };

  // --- Export Logic ---
  const captureCurrentCanvas = async (element) => {
    // Calculate scale based on DPI
    const dpiScale = exportDPI / 96; // 96 is base DPI

    // Reset zoom/transform to ensure 1:1 capture
    const originalTransform = element.style.transform;
    element.style.transform = 'none';

    // Wait for render
    await new Promise(r => setTimeout(r, 100));

    // Capture with DPI-based scale
    const canvas = await window.html2canvas(element, {
      scale: dpiScale,
      useCORS: true,
      logging: false,
      width: 1587,
      height: 1123,
      windowWidth: 1587,
      windowHeight: 1123
    });

    // Restore
    element.style.transform = originalTransform;

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const generatePDF = async () => {
    if (!window.jspdf || !window.html2canvas) return;
    const { jsPDF } = window.jspdf;
    // A3 Landscape: 420mm x 297mm
    const pdf = new jsPDF('l', 'mm', 'a3');
    const originalIndex = activePageIndex;
    const element = document.getElementById('print-area');

    setIsLoading(true);

    try {
      for (let i = 0; i < pages.length; i++) {
        setActivePageIndex(i);
        await new Promise(r => setTimeout(r, 500)); // Render wait
        const imgData = await captureCurrentCanvas(element);

        if (i > 0) pdf.addPage('a3', 'l');
        pdf.addImage(imgData, 'JPEG', 0, 0, 420, 297);
      }

      pdf.save(`${metaData.brand}_QC.pdf`);
    } catch (e) {
      console.error(e);
      alert("導出失敗，請重試");
    } finally {
      setActivePageIndex(originalIndex);
      setIsLoading(false);
    }
  };

  const generatePPT = async () => {
    if (!window.PptxGenJS) return;
    const pptx = new window.PptxGenJS();
    // Set PPT layout to A3 (approx 16.5 x 11.7 inches)
    pptx.defineLayout({ name: 'A3', width: 16.5, height: 11.7 });
    pptx.layout = 'A3';

    const originalIndex = activePageIndex;
    const element = document.getElementById('print-area');

    setIsLoading(true);
    try {
      for (let i = 0; i < pages.length; i++) {
        setActivePageIndex(i);
        await new Promise(r => setTimeout(r, 500));
        const imgData = await captureCurrentCanvas(element);
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
      }
      pptx.writeFile({ fileName: `${metaData.brand}_QC.pptx` });
    } catch (e) {
      console.error(e);
    } finally {
      setActivePageIndex(originalIndex);
      setIsLoading(false);
    }
  };

  // Filter Library
  const currentLibraryItems = libraryAssets.filter(item => {
    const matchesFolder = item.folder === activeFolder || (!item.folder && activeFolder === 'TM'); // Fallback for old items
    const matchesSearch = item.name.toLowerCase().includes(librarySearch.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans overflow-hidden">
      {/* --- Top Bar --- */}
      <div className="bg-slate-800 text-white p-2 shadow-md z-30 flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-center px-2">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Layers size={20} className="text-blue-400" />
            QC Visualizer <span className="text-xs text-gray-400">v3.5 A3 Pro</span>
          </h1>

          <div className="flex items-center gap-2 bg-slate-700 px-3 py-1 rounded-full border border-slate-600">
            <ZoomOut size={14} className="text-gray-300" />
            <input type="range" min="0.2" max="1.2" step="0.1" value={viewZoom} onChange={(e) => setViewZoom(parseFloat(e.target.value))} className="w-24 h-1 cursor-pointer" />
            <ZoomIn size={14} className="text-gray-300" />
            <span className="text-xs text-gray-400 w-8">{Math.round(viewZoom * 100)}%</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm"><History size={16} /> 紀錄</button>
            <button onClick={generatePPT} disabled={isLoading} className="flex items-center gap-2 px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-sm font-semibold"><MonitorPlay size={16} /> PPT</button>
            <button onClick={generatePDF} disabled={isLoading} className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold"><Download size={16} /> PDF</button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-slate-900 text-sm px-2">
          <input className="px-2 py-1 rounded" value={metaData.brand} onChange={e => setMetaData({ ...metaData, brand: e.target.value })} placeholder="Brand" />
          <input className="px-2 py-1 rounded" value={metaData.product} onChange={e => setMetaData({ ...metaData, product: e.target.value })} placeholder="Model" />
          <input className="px-2 py-1 rounded" type="date" value={metaData.date} onChange={e => setMetaData({ ...metaData, date: e.target.value })} />
          <input className="px-2 py-1 rounded" value={metaData.version} onChange={e => setMetaData({ ...metaData, version: e.target.value })} placeholder="Ver" />
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center text-white flex-col">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <div>處理中... (正在生成 A3 高解析文件)</div>
        </div>
      )}

      {/* --- Main Layout --- */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* --- Tools Toolbar --- */}
        <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 z-10 shadow-sm shrink-0">
          <ToolButton active={mode === 'move'} onClick={() => { setMode('move'); setSelectedId(null); }} icon={<Move size={20} />} label="選取" />
          <ToolButton active={mode === 'arrow'} onClick={() => { setMode('arrow'); setSelectedId(null); }} icon={<ArrowRight size={20} />} label="箭頭" />
          <div className="h-px w-8 bg-gray-300 my-2"></div>
          <button onClick={deleteSelected} disabled={!selectedId} className={`p-2 rounded flex flex-col items-center gap-1 text-xs ${selectedId ? 'text-red-500 hover:bg-red-50' : 'text-gray-300'}`}>
            <Trash2 size={20} />
          </button>
        </div>

        {/* --- Canvas Area --- */}
        <div className="flex-1 bg-gray-200 overflow-hidden relative flex flex-col">

          {/* Page Tabs */}
          <div className="h-10 bg-gray-300 flex items-end px-4 gap-1 overflow-x-auto shrink-0 border-b border-gray-400">
            {pages.map((p, i) => (
              <div
                key={p.id}
                onClick={() => setActivePageIndex(i)}
                className={`group relative px-4 py-2 rounded-t-lg text-sm font-bold cursor-pointer flex items-center gap-2 select-none pr-8 transition-colors ${i === activePageIndex ? 'bg-white text-slate-800 shadow-sm pt-3' : 'bg-gray-400 text-gray-700 hover:bg-gray-350'}`}
              >
                {p.name}
                {pages.length > 1 && (
                  <button
                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-red-200 hover:text-red-600 ${i === activePageIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => deletePage(i, e)}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addPage} className="px-3 py-2 text-gray-600 hover:text-slate-800 hover:bg-black/5 rounded"><Plus size={18} /></button>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-gray-200 relative">
            <div
              className="relative shadow-2xl origin-top transition-transform duration-100 ease-out bg-white"
              // A3 Size: 1587px x 1123px (approx 96 DPI)
              style={{ transform: `scale(${viewZoom})`, width: '1587px', height: '1123px' }}
            >
              <div
                id="print-area"
                ref={canvasRef}
                className={`relative w-full h-full select-none overflow-hidden ${mode === 'arrow' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              >
                {/* Print Header */}
                <div className="h-20 border-b-2 border-black flex justify-between items-center px-8 bg-white z-20 relative">
                  <div className="flex items-baseline gap-4">
                    <div className="text-3xl font-bold uppercase tracking-tight">{metaData.brand}</div>
                    <div className="text-2xl font-normal text-gray-600 border-l-2 border-gray-300 pl-4">{metaData.product}</div>
                  </div>
                  <div className="text-right text-base">
                    <div className="font-semibold text-gray-800">QC Checklist / {activePage.name}</div>
                    <div className="text-gray-500">{metaData.date} | {metaData.version}</div>
                  </div>
                </div>

                {/* Content Layer */}
                <div className="relative w-full h-[calc(100%-5rem)] bg-white overflow-hidden">

                  {/* Main Product Image */}
                  {activePage.mainImage ? (
                    <div
                      className="absolute cursor-move origin-top-left"
                      style={{
                        transform: `translate(${activePage.mainImagePos.x}px, ${activePage.mainImagePos.y}px) scale(${activePage.mainImagePos.scale / 100})`,
                        pointerEvents: (activePage.isMainImageLocked || mode === 'arrow') ? 'none' : 'auto',
                        zIndex: 1
                      }}
                      onMouseDown={(e) => {
                        if (activePage.isMainImageLocked || mode !== 'move') return;
                        e.preventDefault();
                        const startX = e.clientX - activePage.mainImagePos.x;
                        const startY = e.clientY - activePage.mainImagePos.y;
                        const handleMove = (ev) => updatePage({ mainImagePos: { ...activePage.mainImagePos, x: ev.clientX - startX, y: ev.clientY - startY } });
                        const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                        window.addEventListener('mousemove', handleMove);
                        window.addEventListener('mouseup', handleUp);
                      }}
                    >
                      <img src={activePage.mainImage} className="max-w-none pointer-events-none" alt="Product" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
                      <FileImage size={96} />
                      <p className="text-xl mt-4">請從右側上傳底圖 (A3 畫布)</p>
                    </div>
                  )}

                  {/* Canvas Items (Locked if editing main image) */}
                  <div className={`absolute inset-0 z-10 ${!activePage.isMainImageLocked ? 'pointer-events-none opacity-50' : ''}`}>
                    {activePage.items.map((item) => (
                      <CanvasItem
                        key={item.canvasId}
                        item={item}
                        isSelected={selectedId === item.canvasId && selectedType === 'item'}
                        onSelect={() => { if (mode !== 'arrow') { setSelectedId(item.canvasId); setSelectedType('item'); } }}
                        onUpdate={(updates) => updatePage({ items: activePage.items.map(i => i.canvasId === item.canvasId ? { ...i, ...updates } : i) })}
                        isLocked={mode === 'arrow'}
                      />
                    ))}
                  </div>

                  {/* Arrows Layer */}
                  <svg className={`absolute inset-0 w-full h-full z-20 pointer-events-none ${!activePage.isMainImageLocked ? 'opacity-50' : ''}`}>
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 z" fill="#dc2626" />
                      </marker>
                    </defs>

                    {activePage.arrows.map(arrow => (
                      <EditableArrow
                        key={arrow.id}
                        arrow={arrow}
                        isSelected={selectedId === arrow.id && selectedType === 'arrow'}
                        onSelect={() => { if (mode !== 'arrow') { setSelectedId(arrow.id); setSelectedType('arrow'); } }}
                        onUpdate={(updates) => updateArrow(arrow.id, updates)}
                        isEditing={!activePage.isMainImageLocked} // Disable if editing main image
                      />
                    ))}

                    {/* Temporary Dragging Arrow */}
                    {tempArrow && (
                      <line
                        x1={tempArrow.start.x} y1={tempArrow.start.y}
                        x2={tempArrow.end.x} y2={tempArrow.end.y}
                        stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4" markerEnd="url(#arrowhead)"
                      />
                    )}
                  </svg>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Right Sidebar --- */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col z-10 shadow-lg shrink-0">

          {/* Main Image Control Panel */}
          <div className="p-4 border-b border-gray-200 bg-slate-50">
            <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
              1. 底圖 / 頁面控制
            </h3>

            {/* Main Image Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => updatePage({ isMainImageLocked: !activePage.isMainImageLocked })}
                className={`flex-1 py-2 text-xs rounded border flex items-center justify-center gap-1 font-bold transition-colors ${!activePage.isMainImageLocked
                  ? 'bg-green-100 border-green-300 text-green-700 animate-pulse'
                  : 'bg-white border-gray-300 text-gray-600'
                  }`}
              >
                {!activePage.isMainImageLocked ? <Unlock size={14} /> : <Lock size={14} />}
                {!activePage.isMainImageLocked ? "正在調整底圖" : "底圖已鎖定"}
              </button>
            </div>

            {/* Main Image Controls (Visible only when unlocked) */}
            {!activePage.isMainImageLocked && (
              <div className="bg-white p-2 rounded border border-green-200 mb-2 shadow-sm">
                <div className="text-xs text-green-600 mb-2 font-medium">現在可以拖曳或縮放底圖：</div>
                <input type="file" className="text-xs mb-2 w-full" accept="image/*" onChange={handleMainImageUpload} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">縮放:</span>
                  <input
                    type="range" min="10" max="200" step="1"
                    value={activePage.mainImagePos.scale}
                    onChange={(e) => updatePage({ mainImagePos: { ...activePage.mainImagePos, scale: parseInt(e.target.value) } })}
                    className="flex-1 h-1"
                  />
                  <span className="text-xs w-8 text-right">{activePage.mainImagePos.scale}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab('upload')}
              className={`flex-1 py-2 text-sm font-medium ${tab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              2. 當前素材
            </button>
            <button
              onClick={() => setTab('library')}
              className={`flex-1 py-2 text-sm font-medium ${tab === 'library' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              3. 資料庫
            </button>
          </div>

          {/* Assets Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">

            {/* Tab 1: Current Uploads */}
            {tab === 'upload' && (
              <>
                <label className="block mb-4">
                  <span className="bg-white border border-dashed border-blue-300 text-blue-600 py-4 rounded-lg flex flex-col items-center gap-2 cursor-pointer hover:bg-blue-50 transition">
                    <Upload size={20} />
                    <span className="text-xs font-bold">上傳新素材 (Img/PDF)</span>
                  </span>
                  <input type="file" multiple className="hidden" accept="image/*, .pdf" onChange={handleAssetUpload} disabled={isLoading} />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {assets.map(asset => (
                    <div key={asset.id} className="relative group bg-white border rounded p-1 shadow-sm hover:ring-2 hover:ring-blue-400">
                      <div
                        className="h-20 flex items-center justify-center overflow-hidden cursor-move"
                        onClick={() => addToCanvas(asset)}
                      >
                        <img src={asset.src} className="max-h-full max-w-full" alt={asset.name} />
                      </div>
                      <div className="text-[10px] truncate px-1 mt-1 text-gray-600">{asset.name}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); saveToLibrary(asset); }}
                        title="存入資料庫"
                        className="absolute top-1 right-1 bg-white/80 p-1.5 rounded hover:bg-purple-100 text-purple-600 opacity-0 group-hover:opacity-100 transition shadow"
                      >
                        <Database size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {assets.length === 0 && <div className="text-center text-xs text-gray-400 mt-10">尚無素材</div>}
              </>
            )}

            {/* Tab 2: Library */}
            {tab === 'library' && (
              <>
                {/* Folder Selector */}
                <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
                  {folders.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFolder(f)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFolder === f ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                      {f}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAddFolder(true)}
                    className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    <FolderPlus size={14} />
                  </button>
                </div>

                {/* Add Folder Input */}
                {showAddFolder && (
                  <div className="mb-3 flex gap-2">
                    <input
                      className="flex-1 px-2 py-1 text-xs border rounded"
                      placeholder="新資料夾名稱..."
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      autoFocus
                    />
                    <button onClick={createFolder} className="px-2 py-1 bg-green-500 text-white rounded text-xs">OK</button>
                    <button onClick={() => setShowAddFolder(false)} className="px-2 py-1 bg-gray-300 rounded text-xs">X</button>
                  </div>
                )}

                <div className="relative mb-3">
                  <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                  <input
                    className="w-full pl-8 pr-2 py-2 text-sm border rounded bg-white"
                    placeholder={`搜尋 ${activeFolder}...`}
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {currentLibraryItems.map(asset => (
                    <div key={asset.id} className="relative group bg-white border border-purple-200 rounded p-1 shadow-sm hover:ring-2 hover:ring-purple-400">
                      <div
                        className="h-20 flex items-center justify-center overflow-hidden cursor-move"
                        onClick={() => addToCanvas(asset)}
                      >
                        <img src={asset.src} className="max-h-full max-w-full" alt={asset.name} />
                      </div>
                      <div className="text-[10px] truncate px-1 mt-1 text-gray-600">{asset.name}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFromLibrary(asset.id); }}
                        className="absolute top-1 right-1 bg-white/80 p-1.5 rounded hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition shadow"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {currentLibraryItems.length === 0 && <div className="text-center text-xs text-gray-400 mt-10">資料庫 {activeFolder} 是空的</div>}
              </>
            )}

          </div>

        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

const ToolButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`p-2 rounded-lg flex flex-col items-center gap-1 w-full ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
    {icon} <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const CanvasItem = ({ item, isSelected, onSelect, onUpdate, isLocked }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (isLocked) return;
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging) return;
      onUpdate({ x: item.x + (e.clientX - startPos.x), y: item.y + (e.clientY - startPos.y) });
      setStartPos({ x: e.clientX, y: e.clientY });
    };
    const onUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
  }, [isDragging, startPos]);

  return (
    <div
      style={{ left: item.x, top: item.y, width: item.width, position: 'absolute' }}
      onMouseDown={handleMouseDown}
      className={`group ${isSelected ? 'ring-1 ring-blue-500 ring-dashed cursor-move' : 'cursor-grab'}`}
    >
      <img src={item.src} className="w-full h-auto pointer-events-none" alt="" />
      {isSelected && (
        <>
          <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startW = item.width;
              const onResize = (ev) => onUpdate({ width: Math.max(20, startW + (ev.clientX - startX)) });
              const stop = () => { window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stop); };
              window.addEventListener('mousemove', onResize);
              window.addEventListener('mouseup', stop);
            }}
          />
        </>
      )}
    </div>
  );
};

// --- Refined Arrow Component (Editable) ---
const EditableArrow = ({ arrow, isSelected, onSelect, onUpdate, isEditing }) => {
  const midX = arrow.mid ? arrow.mid.x : (arrow.start.x + arrow.end.x) / 2;
  const midY = arrow.mid ? arrow.mid.y : (arrow.start.y + arrow.end.y) / 2;

  const d = arrow.mid
    ? `M${arrow.start.x},${arrow.start.y} Q${arrow.mid.x},${arrow.mid.y} ${arrow.end.x},${arrow.end.y}`
    : `M${arrow.start.x},${arrow.start.y} L${arrow.end.x},${arrow.end.y}`;

  return (
    <g onClick={onSelect} className={`${isSelected ? 'opacity-100' : 'opacity-80'} hover:opacity-100 cursor-pointer pointer-events-auto`}>
      <path d={d} stroke="transparent" strokeWidth="20" fill="none" />
      <path d={d} stroke="#dc2626" strokeWidth={arrow.width} fill="none" markerEnd="url(#arrowhead)" />

      {isSelected && isEditing && (
        <>
          <circle cx={arrow.start.x} cy={arrow.start.y} r="4" fill="white" stroke="#dc2626" />
          <circle cx={arrow.end.x} cy={arrow.end.y} r="4" fill="white" stroke="#dc2626" />
          <circle
            cx={midX} cy={midY} r="3" fill="#dc2626" className="cursor-move"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!arrow.mid) {
                onUpdate({ mid: { x: midX + 20, y: midY + 20 } });
              } else {
                onUpdate({ mid: null });
              }
            }}
          />
        </>
      )}
    </g>
  );
};

export default QCChartApp;
