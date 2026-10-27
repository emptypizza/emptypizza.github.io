/* ===== GGHF ISLAND 3D — 지브리풍 작은 행성 (실패 시 2D 페이지 자동 폴백) ===== */
try {
    const THREE = await import('three');
    const content = window.GGHF_CONTENT;
    const projects = Object.fromEntries(content.projects.map(project => [project.id, project]));
    let audioCtx = null;

    const R = 13;
    const LAT_MAX = 0.345;
    const LAT_LAND = 0.30;
    const LAT_BEACH = 0.385;
    const LAT_OCEAN_END = 1.30;
    const INLET_LON = Math.PI;
    const INLET_HALF = 0.070;
    const BRIDGE_HALF = 0.075;

    const C = {
        seaBase: '#58c8bc', seaLight1: '#7addcc', seaLight2: '#8ce4d6', seaDark: '#46b4ac',
        beach: '#e6d7ae', beachDark: '#d2bf93',
        grass: '#7ab27c', grassLight: '#8fc68f', grassMid: '#6ca877', grassDark: '#5d9968', bush: '#3f7f68',
        path: '#dbc9a0', pathEdge: '#c1ab80',
        cap: '#ead9b5', capDark: '#d6c298',
        foam: '#ffffff',
        ink: 0x3a2f22, wood: 0x7a5a3d, woodDark: 0x5b4130, trunk: 0x6d4c33,
        plaster: 0xf2e8d2, rock: 0xcbb691,
        treeDark: 0x2f6b5e, treeMid: 0x3a7a66, treeLight: 0x5fa07f, pine: 0x2a5e55,
        skin: 0xedc39b, shirt: 0x4a7fb5, shorts: 0x3d4660, hair: 0x2a2622,
        white: 0xf3ead6
    };

    const wrap = document.getElementById('village-canvas-wrap');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    wrap.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '작은 행성 이동 영역');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);

    const gradData = new Uint8Array([120, 120, 120, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
    const grad = new THREE.DataTexture(gradData, 3, 1, THREE.RGBAFormat);
    grad.minFilter = THREE.NearestFilter;
    grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    const toon = (color, opts = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts });

    const hemiL = new THREE.HemisphereLight(0xd8f2e6, 0xc9b28e, 0.7);
    scene.add(hemiL);
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.2);
    sun.position.set(-16, 20, 10);
    scene.add(sun);
    const ambL = new THREE.AmbientLight(0xfff4e0, 0.32);
    scene.add(ambL);

    function wrapLon(lon) {
        while (lon > Math.PI) lon -= 2 * Math.PI;
        while (lon < -Math.PI) lon += 2 * Math.PI;
        return lon;
    }
    function planetPos(lon, lat, out) {
        const cl = Math.cos(lat);
        out = out || new THREE.Vector3();
        return out.set(R * cl * Math.sin(lon), R * Math.sin(lat), R * cl * Math.cos(lon));
    }
    function planetBasis(lon, lat, up, east, north) {
        planetPos(lon, lat, up).normalize();
        east.set(Math.cos(lon), 0, -Math.sin(lon));
        east.addScaledVector(up, -east.dot(up));
        if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
        else east.normalize();
        north.crossVectors(up, east).normalize();
    }
    const _m4 = new THREE.Matrix4();
    const _p = new THREE.Vector3(), _upV = new THREE.Vector3(), _tgt = new THREE.Vector3();
    function orientOnPlanet(obj, lon, lat, faceTan, lift = 0) {
        planetPos(lon, lat, _p);
        _upV.copy(_p).normalize();
        obj.position.copy(_p).addScaledVector(_upV, lift);
        if (faceTan && faceTan.lengthSq() > 1e-8) {
            _tgt.copy(_p).add(faceTan);
            _m4.lookAt(_p, _tgt, _upV);
            obj.quaternion.setFromRotationMatrix(_m4);
        } else {
            obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _upV);
        }
    }

    function blob(g, x, y, rx, ry, color, alpha, rot = 0) {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.globalAlpha = alpha;
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
    }
    const TEXW = 2048, TEXH = 1024;
    const uForLon = lon => {
        let u = (lon + Math.PI / 2) / (2 * Math.PI);
        u -= Math.floor(u);
        return u * TEXW;
    };
    const yForLat = lat => (0.5 - lat / Math.PI) * TEXH;

    function paintPlanet() {
        const c = document.createElement('canvas');
        c.width = TEXW; c.height = TEXH;
        const g = c.getContext('2d');

        const yLandN = yForLat(LAT_LAND), yLandS = yForLat(-LAT_LAND);
        const yBeachN = yForLat(LAT_BEACH), yBeachS = yForLat(-LAT_BEACH);
        const yOceanN = yForLat(LAT_OCEAN_END), yOceanS = yForLat(-LAT_OCEAN_END);

        g.fillStyle = C.cap;      g.fillRect(0, 0, TEXW, TEXH);
        g.fillStyle = C.seaBase;  g.fillRect(0, yOceanN, TEXW, yBeachN - yOceanN);
        g.fillStyle = C.seaBase;  g.fillRect(0, yBeachS, TEXW, yOceanS - yBeachS);
        g.fillStyle = C.beach;    g.fillRect(0, yBeachN, TEXW, yLandN - yBeachN);
        g.fillStyle = C.beach;    g.fillRect(0, yLandS, TEXW, yBeachS - yLandS);
        g.fillStyle = C.grass;    g.fillRect(0, yLandN, TEXW, yLandS - yLandN);

        const rnd = (a, b) => a + Math.random() * (b - a);
        const wrapBlob = (x, y, rx, ry, col, a, rot) => {
            blob(g, x, y, rx, ry, col, a, rot);
            blob(g, x - TEXW, y, rx, ry, col, a, rot);
            blob(g, x + TEXW, y, rx, ry, col, a, rot);
        };

        for (let i = 0; i < 260; i++) {
            const north = Math.random() < 0.5;
            const y = north ? rnd(yOceanN + 8, yBeachN - 6) : rnd(yBeachS + 6, yOceanS - 8);
            const col = [C.seaLight1, C.seaLight2, C.seaDark][(Math.random() * 3) | 0];
            wrapBlob(rnd(0, TEXW), y, rnd(16, 68), rnd(3.5, 9), col, rnd(0.25, 0.5), rnd(-0.08, 0.08));
        }
        for (let i = 0; i < 340; i++) {
            const y = rnd(yLandN + 4, yLandS - 4);
            const col = [C.grassLight, C.grassMid, C.grassDark][(Math.random() * 3) | 0];
            wrapBlob(rnd(0, TEXW), y, rnd(10, 42), rnd(6, 20), col, rnd(0.16, 0.34), rnd(0, Math.PI));
        }
        for (let i = 0; i < 70; i++) {
            const y = rnd(yLandN + 10, yLandS - 10);
            wrapBlob(rnd(0, TEXW), y, rnd(14, 34), rnd(8, 18), C.bush, rnd(0.10, 0.20), rnd(0, Math.PI));
        }
        for (let i = 0; i < 150; i++) {
            const north = Math.random() < 0.5;
            const y = north ? rnd(yBeachN, yLandN) : rnd(yLandS, yBeachS);
            wrapBlob(rnd(0, TEXW), y, rnd(8, 26), rnd(3, 8), Math.random() < 0.5 ? C.beachDark : '#f2e6c4', rnd(0.2, 0.4));
        }
        for (let i = 0; i < 120; i++) {
            const north = Math.random() < 0.5;
            const y = north ? rnd(2, yOceanN) : rnd(yOceanS, TEXH - 2);
            wrapBlob(rnd(0, TEXW), y, rnd(6, 22), rnd(3, 9), Math.random() < 0.6 ? C.capDark : '#f4e7c6', rnd(0.2, 0.38));
        }

        const inletX = uForLon(INLET_LON);
        const inletHalfPx = (INLET_HALF / (2 * Math.PI)) * TEXW;
        for (let y = Math.floor(yOceanN); y < yOceanS; y += 2) {
            const wob = Math.sin(y * 0.045) * 4 + Math.sin(y * 0.013 + 2) * 3;
            const half = inletHalfPx + Math.sin(y * 0.03 + 1) * 3;
            g.fillStyle = C.seaBase;
            g.fillRect(inletX - half + wob, y, half * 2, 2.2);
        }
        for (let i = 0; i < 26; i++) {
            blob(g, inletX + rnd(-inletHalfPx * 0.6, inletHalfPx * 0.6), rnd(yBeachN, yBeachS), rnd(6, 16), rnd(2.5, 5), C.seaLight1, rnd(0.3, 0.5));
        }

        g.strokeStyle = C.foam;
        const foamLine = (baseY, phase) => {
            g.lineWidth = 3.2;
            g.globalAlpha = 0.75;
            g.beginPath();
            for (let x = 0; x <= TEXW; x += 7) {
                const y = baseY + Math.sin(x * 0.028 + phase) * 4.2 + Math.sin(x * 0.009 + phase * 2) * 3;
                x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
            }
            g.stroke();
            g.lineWidth = 1.8;
            g.globalAlpha = 0.35;
            g.beginPath();
            for (let x = 0; x <= TEXW; x += 7) {
                const dir = baseY < TEXH / 2 ? -1 : 1;
                const y = baseY + dir * 9 + Math.sin(x * 0.024 + phase + 1.4) * 4;
                x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
            }
            g.stroke();
            g.globalAlpha = 1;
        };
        foamLine(yBeachN, 0.4);
        foamLine(yBeachS, 2.1);
        g.globalAlpha = 0.65;
        g.lineWidth = 2.6;
        [-1, 1].forEach(s => {
            g.beginPath();
            for (let y = yBeachN; y <= yBeachS; y += 6) {
                const x = inletX + s * (inletHalfPx + 1) + Math.sin(y * 0.05 + s) * 3;
                y === yBeachN ? g.moveTo(x, y) : g.lineTo(x, y);
            }
            g.stroke();
        });
        g.globalAlpha = 1;

        const yEq = TEXH / 2;
        const pathAt = x => yEq + Math.sin((x / TEXW) * Math.PI * 6) * 8;
        const inInlet = x => Math.abs(x - inletX) < inletHalfPx + 6 || Math.abs(x - inletX + TEXW) < inletHalfPx + 6 || Math.abs(x - inletX - TEXW) < inletHalfPx + 6;
        for (let x = 0; x < TEXW; x += 3) {
            if (inInlet(x)) continue;
            const cy = pathAt(x);
            g.globalAlpha = 1;
            g.fillStyle = C.path;
            g.fillRect(x, cy - 13, 3, 26);
            g.globalAlpha = 0.65;
            g.fillStyle = C.pathEdge;
            g.fillRect(x, cy - 14.5, 3, 2.4);
            g.fillRect(x, cy + 12.1, 3, 2.4);
        }
        g.globalAlpha = 1;
        for (let i = 0; i < 90; i++) {
            const x = rnd(0, TEXW);
            if (inInlet(x)) continue;
            blob(g, x, pathAt(x) + rnd(-8, 8), rnd(1.6, 3.4), rnd(1.2, 2.4), '#b9a37a', rnd(0.35, 0.6));
        }

        SPOT_DEFS.forEach(s => {
            const x = uForLon(s.lon);
            const yB = yForLat(s.side * 0.13);
            const steps = 5;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const y = yEq + (yB - yEq) * t;
                wrapBlob(x + Math.sin(t * 5 + s.lon) * 3, y, 11 - t * 2, 8, C.path, 0.9);
            }
        });

        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
    }

    function paintShimmer() {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const g = c.getContext('2d');
        g.clearRect(0, 0, 1024, 512);
        const yBn = (0.5 - LAT_BEACH / Math.PI) * 512, yOn = (0.5 - LAT_OCEAN_END / Math.PI) * 512;
        const yBs = (0.5 + LAT_BEACH / Math.PI) * 512, yOs = (0.5 + LAT_OCEAN_END / Math.PI) * 512;
        for (let i = 0; i < 190; i++) {
            const north = Math.random() < 0.5;
            const y = north ? yOn + Math.random() * (yBn - yOn) : yBs + Math.random() * (yOs - yBs);
            blob(g, Math.random() * 1024, y, 8 + Math.random() * 34, 1.6 + Math.random() * 3.4, '#ffffff', 0.25 + Math.random() * 0.35);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    function paintPlaster() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const g = c.getContext('2d');
        g.fillStyle = '#f2e8d2';
        g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 54; i++) {
            blob(g, Math.random() * 256, Math.random() * 256, 12 + Math.random() * 34, 8 + Math.random() * 22,
                ['#e7d9ba', '#faf3e2', '#e2d2b0'][(Math.random() * 3) | 0], 0.14);
        }
        for (let i = 0; i < 9; i++) {
            g.globalAlpha = 0.08;
            g.fillStyle = '#c9b28e';
            g.fillRect(0, Math.random() * 256, 256, 1.5);
        }
        g.globalAlpha = 1;
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    function makeSky() {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 512;
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 512);
        gr.addColorStop(0, '#9fd3d4');
        gr.addColorStop(0.42, '#c9e9dc');
        gr.addColorStop(0.72, '#f0e8cf');
        gr.addColorStop(1, '#f7e6c6');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 512);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(220, 24, 16),
            new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false })
        );
        scene.add(sky);

        const sc = document.createElement('canvas');
        sc.width = sc.height = 128;
        const sg = sc.getContext('2d');
        const rad = sg.createRadialGradient(64, 64, 6, 64, 64, 62);
        rad.addColorStop(0, 'rgba(255,250,225,1)');
        rad.addColorStop(0.35, 'rgba(255,243,200,0.9)');
        rad.addColorStop(1, 'rgba(255,240,200,0)');
        sg.fillStyle = rad;
        sg.fillRect(0, 0, 128, 128);
        const stex = new THREE.CanvasTexture(sc);
        stex.colorSpace = THREE.SRGBColorSpace;
        const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, transparent: true, depthWrite: false }));
        sunSpr.position.set(-120, 130, 70);
        sunSpr.scale.setScalar(70);
        scene.add(sunSpr);
        return { sky, sunSpr };
    }

    const D2R = Math.PI / 180;
    const SPOT_DEFS = [
        { id: 'kmm',   kor: 'KMM ARCADE',   sub: 'NEON CABINET', lon: -90 * D2R,  side: 1,  color: '#12a5b8',
          desc: '섬의 오락기. 동쪽 빌라에서 kmm adventure를 플레이할 수 있습니다.', badge: 'DECOR', kind: 'arcade' },
        { id: 'gghf',  kor: 'GGHF STUDIO',  sub: 'RED ROOF · itch.io', lon: -30 * D2R, side: -1, color: '#b5453c',
          desc: 'GGHF 인디 게임 스튜디오. itch.io에서 프로토타입과 출시작을 만나보세요.',
          link: 'https://gghf.itch.io', actLabel: 'gghf.itch.io 열기 (E)', kind: 'cottage', roof: 0xb5453c, chimney: true },
        { id: 'nemo',  kor: 'NEMO_D.O',     sub: 'LIVE - GOOGLE PLAY', lon: 30 * D2R, side: 1, color: '#c9773b',
          desc: projects.nemo.description,
          badge: projects.nemo.status,
          link: 'https://play.google.com/store/apps/details?id=com.GGHF.Nemo_DO', actLabel: 'Google Play (E)', kind: 'cottage', roof: 0xc9773b, antenna: true },
        { id: 'hite',  kor: 'EAST VILLA',   sub: '9 WINDOWS · TRAIL GAME', lon: 90 * D2R, side: -1, color: '#c76a9e',
          desc: '창문 아홉 개짜리 동쪽 빌라. E를 누르면 kmm adventure 트레일 게임을 바로 플레이합니다.',
          play: true, actLabel: '트레일 게임 (E)', kind: 'villa' },
        { id: 'paper', kor: 'PAPER HEROES', sub: 'IN DEV', lon: 150 * D2R, side: 1, color: '#5a63a8',
          desc: projects.paper.description, badge: projects.paper.status, kind: 'cottage', roof: 0x4a5286, banner: true },
        { id: 'study', kor: 'VIBECODING',   sub: 'OPEN - GANGNAM', lon: -150 * D2R, side: -1, color: '#b98f2f',
          desc: '현업 게임인끼리 AI 도구 시행착오를 나누는 강남 오프라인 스터디.',
          link: content.study.url, actLabel: '참여 문의 (E)', kind: 'cafe', roof: 0xb99341 },
        { id: 'rocket', kor: 'LAUNCH PAD', sub: 'DAY - SPACE', lon: 60 * D2R, side: -1, color: '#8be9fd',
          desc: '우주 발사대. E를 누르면 로켓을 타고 반대편 세계로 — 낮의 섬과 검은 우주를 오갑니다.',
          actLabel: '발사 (E)', kind: 'rocket', launch: true }
    ];

    for (const spot of SPOT_DEFS) {
        const project = projects[spot.id === 'hite' ? 'kmm' : spot.id];
        if (project && spot.id !== 'kmm') {
            spot.kor = project.title;
            spot.sub = project.status;
            spot.desc = project.description;
            spot.badge = project.technology;
            if (!spot.play) { spot.link = project.url; spot.actLabel = project.action + ' (E)'; }
        }
        if (spot.id === 'study') { spot.kor = content.study.name; spot.desc = content.study.description; spot.link = content.study.url; spot.actLabel = '스터디 안내 (E)'; }
    }

    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), toon(0xffffff, { map: paintPlanet() }));
    scene.add(planet);

    const shimmer = new THREE.Mesh(
        new THREE.SphereGeometry(R + 0.035, 96, 64),
        new THREE.MeshBasicMaterial({ map: paintShimmer(), transparent: true, opacity: 0.55, depthWrite: false })
    );
    scene.add(shimmer);

    const skyRefs = makeSky();

    const plasterTex = paintPlaster();
    const colliders = [];
    const swaySigns = [];

    function signTexture(text, accent) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 160;
        const g = c.getContext('2d');
        g.fillStyle = '#6f5136';
        g.beginPath();
        g.roundRect(0, 0, 512, 160, 20);
        g.fill();
        g.fillStyle = '#eeddb6';
        g.beginPath();
        g.roundRect(12, 12, 488, 136, 12);
        g.fill();
        for (let i = 0; i < 10; i++) blob(g, Math.random() * 512, 12 + Math.random() * 136, 20 + Math.random() * 40, 6 + Math.random() * 10, '#e0cb9c', 0.25);
        g.fillStyle = '#33291d';
        g.font = 'bold 57px "Trebuchet MS", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 256, 72);
        g.fillStyle = accent;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.roundRect(140, 118, 232, 9, 4);
        g.fill();
        g.globalAlpha = 1;
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    // 밤(우주) 모드용 네온 간판
    function signTextureNeon(text, accent) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 160;
        const g = c.getContext('2d');
        g.fillStyle = '#0a0c16';
        g.beginPath();
        g.roundRect(0, 0, 512, 160, 20);
        g.fill();
        g.strokeStyle = accent;
        g.globalAlpha = 0.7;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(9, 9, 494, 142, 14);
        g.stroke();
        g.globalAlpha = 1;
        g.font = 'bold 57px "Trebuchet MS", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = accent;
        g.shadowBlur = 28;
        g.fillStyle = accent;
        g.fillText(text, 256, 78);
        g.shadowBlur = 10;
        g.fillStyle = '#f0ffff';
        g.fillText(text, 256, 78);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    function makeSign(spot) {
        const grp = new THREE.Group();
        const postMat = toon(C.woodDark);
        [-1.15, 1.15].forEach(x => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.85, 7), postMat);
            post.position.set(x, 0.92, 0);
            grp.add(post);
        });
        spot.dayTex = signTexture(spot.kor, spot.color);
        spot.nightTex = signTextureNeon(spot.kor, spot.color);
        const board = new THREE.Mesh(
            new THREE.PlaneGeometry(2.75, 0.85),
            new THREE.MeshBasicMaterial({ map: spot.dayTex, side: THREE.DoubleSide })
        );
        board.position.y = 1.5;
        board.rotation.y = Math.PI;
        grp.add(board);
        swaySigns.push(board);
        spot.signBoard = board;
        return grp;
    }

    function makeWindow(w = 0.5, h = 0.62, lit = false) {
        const g = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(C.white));
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(w - 0.1, h - 0.1),
            lit ? new THREE.MeshBasicMaterial({ color: 0xffd98c }) : toon(0x2b3f47)
        );
        glass.position.z = 0.006;
        g.add(frame, glass);
        g.rotation.y = Math.PI;
        return g;
    }
    function addSideWindows(grp, w, d, ys, lit = false) {
        [-1, 1].forEach(sideX => {
            ys.forEach(([y, z]) => {
                const win = makeWindow(0.46, 0.58, lit);
                win.position.set(sideX * (w / 2 + 0.03), y, z);
                win.rotation.y = sideX > 0 ? Math.PI / 2 : -Math.PI / 2;
                grp.add(win);
            });
        });
    }

    function roofPrism(w, d, roofH, color) {
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, 0);
        shape.lineTo(w / 2, 0);
        shape.lineTo(0, roofH);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        return new THREE.Mesh(geo, toon(color));
    }

    function buildCottage(spot) {
        const grp = new THREE.Group();
        const w = 3.0, h = 2.9, d = 2.8;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(0xffffff, { map: plasterTex }));
        body.position.y = h / 2;
        grp.add(body);
        const roof = roofPrism(w + 0.8, d + 0.7, 1.55, spot.roof || 0xb5453c);
        roof.position.y = h;
        grp.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.4, 0.08), toon(C.woodDark));
        door.position.set(-0.55, 0.7, -d / 2 - 0.04);
        grp.add(door);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), toon(0xd9b968));
        knob.position.set(-0.32, 0.72, -d / 2 - 0.1);
        grp.add(knob);
        [[0.75, 1.7], [-0.55, 1.95]].forEach(([x, y]) => {
            const win = makeWindow();
            win.position.set(x, y, -d / 2 - 0.03);
            grp.add(win);
        });
        addSideWindows(grp, w, d, [[1.75, -0.55], [1.75, 0.6]]);
        if (spot.chimney) {
            const ch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.85, 0.36), toon(0x9c5a48));
            ch.position.set(w * 0.24, h + 0.75, d * 0.14);
            grp.add(ch);
        }
        if (spot.antenna) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), toon(C.ink));
            pole.position.set(-w * 0.22, h + 1.5, 0);
            grp.add(pole);
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), toon(0xc9773b));
            ball.position.set(-w * 0.22, h + 2.1, 0);
            grp.add(ball);
        }
        if (spot.banner) {
            const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.15), new THREE.MeshBasicMaterial({ color: 0xf6f0dd, side: THREE.DoubleSide }));
            bn.position.set(0.85, 1.85, -d / 2 - 0.05);
            bn.rotation.y = Math.PI;
            grp.add(bn);
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), new THREE.MeshBasicMaterial({ color: 0x4a5286, side: THREE.DoubleSide }));
            stripe.position.set(0.85, 2.22, -d / 2 - 0.06);
            stripe.rotation.y = Math.PI;
            grp.add(stripe);
        }
        return { grp, keep: 2.05 };
    }

    function buildVilla() {
        const grp = new THREE.Group();
        const w = 3.3, h = 4.7, d = 2.9;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(0xf6dfe0, { map: plasterTex }));
        body.position.y = h / 2;
        grp.add(body);
        const roof = roofPrism(w + 0.7, d + 0.6, 1.15, 0x7d8494);
        roof.position.y = h;
        grp.add(roof);
        for (let ry = 0; ry < 3; ry++) for (let rx = -1; rx <= 1; rx++) {
            const win = makeWindow(0.46, 0.58, true);
            win.position.set(rx * 0.95, 1.55 + ry * 1.15, -d / 2 - 0.03);
            grp.add(win);
        }
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.45, 0.08), toon(C.woodDark));
        door.position.set(0, 0.72, -d / 2 - 0.04);
        grp.add(door);
        addSideWindows(grp, w, d, [[1.55, -0.6], [2.7, 0.35], [3.85, -0.6]], true);
        return { grp, keep: 2.2 };
    }

    function buildArcade() {
        const grp = new THREE.Group();
        const w = 2.5, h = 4.2, d = 2.1;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(C.wood));
        body.position.y = h / 2;
        grp.add(body);
        const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.62, d + 0.25), toon(0x12a5b8));
        top.position.y = h + 0.3;
        grp.add(top);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.25), new THREE.MeshBasicMaterial({ color: 0x54e6e0 }));
        screen.position.set(0, h * 0.62, -d / 2 - 0.03);
        screen.rotation.y = Math.PI;
        grp.add(screen);
        const slot = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.16), new THREE.MeshBasicMaterial({ color: 0xd9b968 }));
        slot.position.set(0, h * 0.3, -d / 2 - 0.03);
        slot.rotation.y = Math.PI;
        grp.add(slot);
        const stripeL = new THREE.Mesh(new THREE.PlaneGeometry(0.24, h * 0.9), new THREE.MeshBasicMaterial({ color: 0x2e8b83 }));
        stripeL.position.set(-w / 2 - 0.01, h / 2, 0);
        stripeL.rotation.y = -Math.PI / 2;
        grp.add(stripeL);
        const stripeR = stripeL.clone();
        stripeR.position.x = w / 2 + 0.01;
        stripeR.rotation.y = Math.PI / 2;
        grp.add(stripeR);
        return { grp, keep: 1.7 };
    }

    function buildCafe(spot) {
        const built = buildCottage(spot);
        const grp = built.grp;
        const ac = document.createElement('canvas');
        ac.width = 128; ac.height = 64;
        const ag = ac.getContext('2d');
        for (let i = 0; i < 8; i++) {
            ag.fillStyle = i % 2 ? '#c9a45c' : '#f3e2c0';
            ag.fillRect(i * 16, 0, 16, 64);
        }
        const atex = new THREE.CanvasTexture(ac);
        atex.colorSpace = THREE.SRGBColorSpace;
        const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.85), new THREE.MeshBasicMaterial({ map: atex, side: THREE.DoubleSide }));
        awn.position.set(-0.35, 2.1, -1.4 - 0.42);
        awn.rotation.set(0.55, Math.PI, 0);
        grp.add(awn);
        [[-1.15, 1.6], [0.55, 1.6]].forEach(([x, y]) => {
            const lan = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffdf9e }));
            lan.position.set(x, y, -1.4 - 0.25);
            grp.add(lan);
        });
        return built;
    }

    /* ---------- 우주 발사대 + 로켓 ---------- */
    let rocketParts = null;
    function buildRocketPad() {
        const grp = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.22, 20), toon(0x8d94a0));
        pad.position.y = 0.11;
        grp.add(pad);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.06, 20), toon(0xd9b968));
        ring.position.y = 0.23;
        grp.add(ring);
        // 정비탑
        const towerMat = toon(0x5f6672);
        [[1.15, 0.25], [1.45, -0.15]].forEach(([x, z]) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.1, 0.09), towerMat);
            leg.position.set(x, 1.55, z);
            grp.add(leg);
        });
        [1.1, 2.2, 3.0].forEach(y => {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.55), towerMat);
            bar.position.set(1.3, y, 0.05);
            bar.rotation.y = 0.35;
            grp.add(bar);
        });
        // 로켓
        const ship = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.9, 14), toon(0xf3ead6));
        body.position.y = 1.2;
        ship.add(body);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.85, 14), toon(0xc0392b));
        nose.position.y = 2.57;
        ship.add(nose);
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3;
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.42), toon(0xc0392b));
            fin.position.set(Math.sin(a) * 0.52, 0.55, Math.cos(a) * 0.52);
            fin.rotation.y = a;
            ship.add(fin);
        }
        const winRing = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), toon(0x8d94a0));
        winRing.position.set(0, 1.5, -0.485);
        winRing.rotation.y = Math.PI;
        ship.add(winRing);
        const winGlass = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
        winGlass.position.set(0, 1.5, -0.5);
        winGlass.rotation.y = Math.PI;
        ship.add(winGlass);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 10), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
        flame.rotation.x = Math.PI;
        flame.position.y = -0.28;
        flame.visible = false;
        ship.add(flame);
        ship.position.y = 0.22;
        grp.add(ship);
        return { grp, keep: 1.9, ship, flame };
    }

    const _east = new THREE.Vector3(), _north = new THREE.Vector3(), _up = new THREE.Vector3(), _face = new THREE.Vector3();

    SPOT_DEFS.forEach(s => {
        s.lat = s.side * 0.17;
        let built;
        if (s.kind === 'arcade') built = buildArcade();
        else if (s.kind === 'villa') built = buildVilla();
        else if (s.kind === 'cafe') built = buildCafe(s);
        else if (s.kind === 'rocket') built = buildRocketPad();
        else built = buildCottage(s);

        planetBasis(s.lon, s.lat, _up, _east, _north);
        _face.copy(_north).multiplyScalar(-s.side);
        orientOnPlanet(built.grp, s.lon, s.lat, _face);
        scene.add(built.grp);
        if (s.kind === 'rocket') {
            rocketParts = { ship: built.ship, flame: built.flame, baseY: built.ship.position.y, padPos: built.grp.position.clone() };
        }

        const sign = makeSign(s);
        const signLat = s.side * 0.058;
        const signLonOff = 0.145;
        planetBasis(s.lon + signLonOff, signLat, _up, _east, _north);
        _face.copy(_north).multiplyScalar(-s.side);
        orientOnPlanet(sign, s.lon + signLonOff, signLat, _face);
        scene.add(sign);

        s.pos = planetPos(s.lon, s.lat);
        colliders.push({ lon: s.lon, lat: s.lat, keep: built.keep });
        colliders.push({ lon: s.lon + signLonOff, lat: signLat, keep: 0.55 });
    });

    function makeTree(scale) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.13 * scale, 1.1 * scale, 6), toon(C.trunk));
        trunk.position.y = 0.55 * scale;
        g.add(trunk);
        const blobs = [
            [0, 1.35, 0, 0.62, C.treeDark],
            [0.34, 1.62, 0.1, 0.48, C.treeMid],
            [-0.3, 1.68, -0.06, 0.42, C.treeMid],
            [0.08, 1.95, -0.02, 0.3, C.treeLight]
        ];
        blobs.forEach(([x, y, z, r, col]) => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 10, 8), toon(col));
            m.position.set(x * scale, y * scale, z * scale);
            g.add(m);
        });
        return g;
    }
    function makePine(scale) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.1 * scale, 0.6 * scale, 6), toon(C.trunk));
        trunk.position.y = 0.3 * scale;
        g.add(trunk);
        [[0.85, 0.58, 0.95], [1.42, 0.46, 0.82], [1.9, 0.33, 0.68]].forEach(([y, r, h]) => {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(r * scale, h * scale, 8), toon(C.pine));
            cone.position.y = y * scale;
            g.add(cone);
        });
        return g;
    }

    const rand = (a, b) => a + Math.random() * (b - a);
    function farFromAll(lon, lat, minSurf) {
        for (const c of colliders) {
            const dLon = wrapLon(lon - c.lon) * Math.cos((lat + c.lat) / 2);
            const dLat = lat - c.lat;
            if (Math.hypot(dLon, dLat) * R < minSurf) return false;
        }
        return true;
    }

    let placed = 0, guard = 0;
    while (placed < 24 && guard++ < 600) {
        const lon = rand(-Math.PI, Math.PI);
        const side = Math.random() < 0.5 ? 1 : -1;
        const lat = side * rand(0.065, 0.29);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.18) continue;
        if (!farFromAll(lon, lat, 2.6)) continue;
        const scale = rand(0.85, 1.6);
        const tree = Math.random() < 0.45 ? makePine(scale) : makeTree(scale);
        planetBasis(lon, lat, _up, _east, _north);
        _face.copy(_east).applyAxisAngle(_up, rand(0, Math.PI * 2));
        orientOnPlanet(tree, lon, lat, _face);
        scene.add(tree);
        colliders.push({ lon, lat, keep: 0.5 * scale });
        placed++;
    }

    for (let i = 0; i < 9; i++) {
        const lon = rand(-Math.PI, Math.PI);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.15) continue;
        const lat = (Math.random() < 0.5 ? 1 : -1) * rand(0.22, 0.335);
        if (!farFromAll(lon, lat, 1.6)) continue;
        const s = rand(0.26, 0.55);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), toon(C.rock));
        rock.scale.y = 0.7;
        orientOnPlanet(rock, lon, lat, null, s * 0.28);
        rock.rotateY(rand(0, Math.PI));
        scene.add(rock);
        if (s > 0.4) colliders.push({ lon, lat, keep: s * 1.4 });
    }

    for (let i = 0; i < 46; i++) {
        const lon = rand(-Math.PI, Math.PI);
        const lat = (Math.random() < 0.5 ? 1 : -1) * rand(0.05, 0.28);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.12) continue;
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 5), toon(C.grassDark));
        orientOnPlanet(tuft, lon, lat, null, 0.07);
        scene.add(tuft);
    }
    const flowerCols = [0xfff3e0, 0xffd54f, 0xef8a80];
    for (let i = 0; i < 22; i++) {
        const lon = rand(-Math.PI, Math.PI);
        const lat = (Math.random() < 0.5 ? 1 : -1) * rand(0.055, 0.16);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.12) continue;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), toon(flowerCols[i % 3]));
        orientOnPlanet(f, lon, lat, null, 0.05);
        scene.add(f);
    }

    function fenceRun(lon0, lon1, lat) {
        const n = Math.max(2, Math.round(Math.abs(lon1 - lon0) / 0.028));
        const postMat = toon(C.white);
        let prev = null;
        for (let i = 0; i <= n; i++) {
            const lon = lon0 + (lon1 - lon0) * (i / n);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.07), postMat);
            planetBasis(lon, lat, _up, _east, _north);
            orientOnPlanet(post, lon, lat, _east.clone(), 0.26);
            scene.add(post);
            if (prev) {
                const mid = prev.clone().add(post.position).multiplyScalar(0.5);
                const len = prev.distanceTo(post.position);
                [0.16, 0.38].forEach(hOff => {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), postMat);
                    const lonM = lon0 + (lon1 - lon0) * ((i - 0.5) / n);
                    planetBasis(lonM, lat, _up, _east, _north);
                    orientOnPlanet(rail, lonM, lat, _east.clone(), 0.26);
                    rail.position.copy(mid).addScaledVector(_up, hOff - 0.26);
                    scene.add(rail);
                });
            }
            prev = post.position.clone();
        }
    }
    fenceRun(-30 * D2R - 0.24, -30 * D2R - 0.1, 0.062);
    fenceRun(90 * D2R + 0.1, 90 * D2R + 0.26, 0.062);
    fenceRun(-150 * D2R + 0.1, -150 * D2R + 0.24, 0.062);
    fenceRun(150 * D2R - 0.2, 150 * D2R - 0.06, -0.3);
    fenceRun(-90 * D2R + 0.08, -90 * D2R + 0.22, -0.3);

    (function mailbox() {
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 6), toon(C.woodDark));
        post.position.y = 0.31;
        g.add(post);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.24), toon(0xc0392b));
        box.position.y = 0.72;
        g.add(box);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10, 1, false, 0, Math.PI), toon(0xa93226));
        cap.rotation.z = Math.PI / 2;
        cap.position.y = 0.85;
        g.add(cap);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), toon(0xd9b968));
        flag.position.set(0.19, 0.86, 0);
        g.add(flag);
        const lon = -30 * D2R + 0.09, lat = -0.095;
        planetBasis(lon, lat, _up, _east, _north);
        _face.copy(_north);
        orientOnPlanet(g, lon, lat, _face);
        scene.add(g);
        colliders.push({ lon, lat, keep: 0.4 });
    })();

    [[-60 * D2R, 0.06], [0, -0.06], [120 * D2R, 0.06], [-120 * D2R, -0.06]].forEach(([lon, lat]) => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 6), toon(0x3a4a42));
        pole.position.y = 0.85;
        g.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
        head.position.y = 1.78;
        g.add(head);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 8), toon(0x3a4a42));
        cap.position.y = 1.94;
        g.add(cap);
        orientOnPlanet(g, lon, lat, null);
        scene.add(g);
        colliders.push({ lon, lat, keep: 0.35 });
    });

    (function powerLines() {
        const tops = [];
        [[48 * D2R, 0.055], [66 * D2R, 0.06]].forEach(([lon, lat]) => {
            const g = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7), toon(0x6b5642));
            pole.position.y = 1.7;
            g.add(pole);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), toon(0x6b5642));
            arm.position.y = 3.05;
            g.add(arm);
            [-0.4, 0.4].forEach(x => {
                const ins = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), toon(C.white));
                ins.position.set(x, 3.14, 0);
                g.add(ins);
            });
            planetBasis(lon, lat, _up, _east, _north);
            orientOnPlanet(g, lon, lat, _north.clone());
            scene.add(g);
            colliders.push({ lon, lat, keep: 0.35 });
            const top = new THREE.Vector3(0, 3.05, 0);
            g.updateMatrixWorld();
            tops.push(top.applyMatrix4(g.matrixWorld));
        });
        if (tops.length === 2) {
            const mid = tops[0].clone().add(tops[1]).multiplyScalar(0.5);
            mid.setLength(mid.length() - 0.45);
            const curve = new THREE.QuadraticBezierCurve3(tops[0], mid, tops[1]);
            const wire = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(curve.getPoints(26)),
                new THREE.LineBasicMaterial({ color: 0x3a332c })
            );
            scene.add(wire);
        }
    })();

    function bridgeLift(lon) {
        const d = Math.abs(wrapLon(lon - INLET_LON));
        if (d >= BRIDGE_HALF) return 0;
        const t = 1 - d / BRIDGE_HALF;
        return 0.1 + Math.sin(t * Math.PI / 2) * 0.32;
    }
    (function bridge() {
        const plankMat = [toon(0x8a6a48), toon(0x947450), toon(0x81613f)];
        const N = 11;
        for (let i = 0; i < N; i++) {
            const lon = INLET_LON - BRIDGE_HALF + (2 * BRIDGE_HALF) * (i / (N - 1));
            const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.30), plankMat[i % 3]);
            planetBasis(lon, 0, _up, _east, _north);
            orientOnPlanet(plank, lon, 0, _east.clone(), bridgeLift(lon));
            scene.add(plank);
        }
        const postMat = toon(C.woodDark);
        [-0.058, 0.058].forEach(latSide => {
            [INLET_LON - BRIDGE_HALF, INLET_LON, INLET_LON + BRIDGE_HALF].forEach(lon => {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 6), postMat);
                orientOnPlanet(post, lon, latSide, null, bridgeLift(lon) + 0.26);
                scene.add(post);
            });
            [[INLET_LON - BRIDGE_HALF / 2, 0.33], [INLET_LON + BRIDGE_HALF / 2, -0.33]].forEach(([lonM, tilt]) => {
                const len = BRIDGE_HALF * R * 1.02;
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), postMat);
                planetBasis(lonM, latSide, _up, _east, _north);
                orientOnPlanet(rail, lonM, latSide, _east.clone(), bridgeLift(lonM) + 0.46);
                rail.rotation.x += tilt;
                scene.add(rail);
            });
        });
    })();

    const cloudPivots = [];
    for (let i = 0; i < 8; i++) {
        const pivot = new THREE.Group();
        const cloud = new THREE.Group();
        const n = 4 + (Math.random() * 3 | 0);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfffdf2 });
        for (let j = 0; j < n; j++) {
            const r = rand(0.5, 1.15);
            const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
            m.position.set(rand(-1.4, 1.4), rand(-0.15, 0.3), rand(-0.5, 0.5));
            cloud.add(m);
        }
        cloud.scale.y = 0.5;
        cloud.position.set(0, 0, R + rand(5.5, 9));
        pivot.add(cloud);
        pivot.rotation.set(rand(-0.7, 0.7), rand(0, Math.PI * 2), rand(-0.4, 0.4));
        scene.add(pivot);
        cloudPivots.push({ pivot, speed: rand(0.008, 0.022) * (Math.random() < 0.5 ? 1 : -1) });
    }

    /* ---------- 우주 테마 (검은 하늘 + 별 + 네온) ---------- */
    scene.background = new THREE.Color(0x04050c);
    const starVerts = [];
    for (let i = 0; i < 460; i++) {
        const u = Math.random(), v = Math.random();
        const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
        const sr = 100 + Math.random() * 60;
        starVerts.push(sr * Math.sin(ph) * Math.cos(th), sr * Math.sin(ph) * Math.sin(th), sr * Math.cos(ph));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc8d8ff, size: 0.4, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
    stars.visible = false;
    scene.add(stars);

    /* ---------- 별자리 (실제 J2000 적경/적위 고증) ---------- */
    // 별: [적경(시), 적위(도), 겉보기등급, 분광형색]  · 선: 별 인덱스 쌍
    const B = '#b7c8ff', BW = '#dbe4ff', W = '#f6f6ff', Y = '#fff4e8', O = '#ffd6a8', RED = '#ffb08a';
    const CONSTELLATIONS = [
        { ko: '오리온자리', en: 'ORION', stars: [
            [5.919, 7.407, 0.42, RED], [5.242, -8.202, 0.18, B], [5.418, 6.350, 1.64, B], [5.533, -0.299, 2.25, B],
            [5.604, -1.202, 1.69, B], [5.679, -1.943, 1.77, B], [5.796, -9.670, 2.06, B], [5.585, 9.934, 3.39, BW]],
          lines: [[0,2],[0,7],[2,7],[0,5],[2,3],[3,4],[4,5],[5,6],[3,1]] },
        { ko: '북두칠성', en: 'BIG DIPPER', stars: [
            [11.062, 61.751, 1.79, O], [11.031, 56.383, 2.37, BW], [11.897, 53.695, 2.44, BW], [12.257, 57.033, 3.31, BW],
            [12.900, 55.960, 1.77, BW], [13.399, 54.925, 2.23, BW], [13.792, 49.313, 1.86, B]],
          lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
        { ko: '카시오페이아자리', en: 'CASSIOPEIA', stars: [
            [0.153, 59.150, 2.28, W], [0.675, 56.537, 2.24, O], [0.945, 60.717, 2.15, B], [1.430, 60.235, 2.68, BW], [1.907, 63.670, 3.35, BW]],
          lines: [[0,1],[1,2],[2,3],[3,4]] },
        { ko: '백조자리', en: 'CYGNUS', stars: [
            [20.690, 45.280, 1.25, BW], [20.371, 40.257, 2.23, W], [20.770, 33.970, 2.48, O], [19.750, 45.131, 2.87, BW], [19.512, 27.960, 3.05, O]],
          lines: [[0,1],[1,4],[3,1],[1,2]] },
        { ko: '거문고자리', en: 'LYRA', stars: [
            [18.615, 38.784, 0.03, BW], [18.835, 33.363, 3.52, BW], [18.982, 32.690, 3.25, BW], [18.908, 36.899, 4.20, BW], [18.746, 37.605, 4.30, BW]],
          lines: [[0,4],[0,3],[4,1],[1,2],[2,3],[3,4]] },
        { ko: '전갈자리', en: 'SCORPIUS', stars: [
            [16.490, -26.432, 1.06, RED], [16.090, -19.805, 2.62, B], [16.006, -22.622, 2.29, B], [15.981, -26.114, 2.89, BW],
            [16.353, -25.593, 2.88, BW], [16.598, -28.216, 2.82, BW], [16.836, -34.293, 2.29, O], [16.865, -38.048, 3.00, BW],
            [16.910, -42.362, 3.60, O], [17.203, -43.239, 3.33, W], [17.622, -42.998, 1.87, W], [17.793, -40.127, 3.03, W],
            [17.708, -39.030, 2.39, BW], [17.560, -37.104, 1.62, B], [17.512, -37.296, 2.69, BW]],
          lines: [[1,2],[2,3],[3,0],[0,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14]] },
        { ko: '작은곰자리', en: 'URSA MINOR', stars: [
            [2.530, 89.264, 1.98, Y], [14.845, 74.156, 2.08, O], [15.345, 71.834, 3.05, BW], [16.292, 75.755, 4.95, BW],
            [15.734, 77.794, 4.32, BW], [16.766, 82.037, 4.21, BW], [17.537, 86.586, 4.36, BW]],
          lines: [[0,6],[6,5],[5,4],[4,3],[3,1],[1,2],[2,4]] },
        { ko: '큰개자리', en: 'CANIS MAJOR', stars: [
            [6.752, -16.716, -1.46, BW], [6.378, -17.956, 1.98, B], [7.140, -26.393, 1.83, W], [6.977, -28.972, 1.50, B],
            [7.402, -29.303, 2.45, BW], [6.338, -30.063, 3.02, BW]],
          lines: [[0,1],[0,2],[2,3],[3,5],[2,4]] },
        { ko: '사자자리', en: 'LEO', stars: [
            [10.140, 11.967, 1.35, B], [11.818, 14.572, 2.11, BW], [10.333, 19.842, 2.08, O], [11.235, 20.524, 2.56, BW],
            [11.237, 15.430, 3.32, BW], [10.122, 16.763, 3.48, BW], [10.278, 23.417, 3.44, BW], [9.764, 23.774, 2.98, Y]],
          lines: [[0,5],[5,2],[2,6],[6,7],[0,4],[4,1],[1,3],[3,2]] },
        { ko: '남십자자리', en: 'CRUX', stars: [
            [12.443, -63.099, 0.77, B], [12.795, -59.689, 1.25, B], [12.520, -57.113, 1.63, RED], [12.252, -58.749, 2.79, BW], [12.356, -60.401, 3.59, O]],
          lines: [[0,2],[1,3]] },
        { ko: '황소자리', en: 'TAURUS', stars: [
            [4.599, 16.509, 0.85, '#ffb367'], [5.438, 28.608, 1.65, B], [4.477, 15.871, 3.40, O], [4.330, 15.628, 3.65, O],
            [4.478, 19.180, 3.53, BW], [5.627, 21.143, 3.00, B]],
          lines: [[3,2],[2,0],[0,4],[4,3],[4,1],[0,5]] },
        { ko: '쌍둥이자리', en: 'GEMINI', stars: [
            [7.755, 28.026, 1.14, O], [7.577, 31.888, 1.58, BW], [6.629, 16.399, 1.93, BW], [7.335, 21.982, 3.53, W],
            [6.732, 25.131, 3.06, Y], [7.068, 20.570, 3.90, W], [6.383, 22.514, 2.87, RED], [6.248, 22.507, 3.30, O]],
          lines: [[1,4],[4,6],[6,7],[0,3],[3,5],[1,0]] }
    ];

    const RSKY = 138;
    function raDecToVec(ra, dec) {
        const raR = ra / 24 * Math.PI * 2, decR = dec * Math.PI / 180, cd = Math.cos(decR);
        return [RSKY * cd * Math.cos(raR), RSKY * Math.sin(decR), RSKY * cd * Math.sin(raR)];
    }
    function constLabel(text) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 64;
        const g = c.getContext('2d');
        g.font = 'bold 30px "Apple SD Gothic Neo", "Trebuchet MS", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(170,195,255,0.95)';
        g.fillText(text, 128, 34);
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false }));
        spr.scale.set(16, 4, 1);
        return spr;
    }
    const constGroup = new THREE.Group();
    (() => {
        const sPos = [], sSize = [], sCol = [], lPos = [], _c = new THREE.Color();
        CONSTELLATIONS.forEach(con => {
            const pts = con.stars.map(s => raDecToVec(s[0], s[1]));
            pts.forEach((p, i) => {
                sPos.push(p[0], p[1], p[2]);
                const mag = con.stars[i][2];
                sSize.push(Math.max(1.6, 7 - mag * 1.4));
                _c.set(con.stars[i][3] || BW); sCol.push(_c.r, _c.g, _c.b);
            });
            (con.lines || []).forEach(([a, b]) => { lPos.push(pts[a][0], pts[a][1], pts[a][2], pts[b][0], pts[b][1], pts[b][2]); });
            const cen = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map(v => v / pts.length);
            const lab = constLabel(con.ko);
            lab.position.set(cen[0], cen[1], cen[2]).multiplyScalar(1.05);
            constGroup.add(lab);
        });
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
        sg.setAttribute('aSize', new THREE.Float32BufferAttribute(sSize, 1));
        sg.setAttribute('aColor', new THREE.Float32BufferAttribute(sCol, 3));
        const sMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            vertexShader: 'attribute float aSize; attribute vec3 aColor; varying vec3 vC; void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(320.0/-mv.z); gl_Position=projectionMatrix*mv; }',
            fragmentShader: 'varying vec3 vC; void main(){ float d=length(gl_PointCoord-vec2(0.5)); if(d>0.5) discard; float a=smoothstep(0.5,0.08,d); gl_FragColor=vec4(vC,a); }'
        });
        constGroup.add(new THREE.Points(sg, sMat));
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
        constGroup.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x6f86c9, transparent: true, opacity: 0.32, depthWrite: false })));
    })();

    /* ---------- 딥스카이 (성운·성단·은하) — 실제 위치 고증 ---------- */
    const DEEPSKY = [
        { ko: '오리온 대성운', ra: 5.588, dec: -5.39, color: 0xff9bb5, sx: 7.5, sy: 6, op: 0.8 },   // M42
        { ko: '플레이아데스', ra: 3.791, dec: 24.105, color: 0xbcd4ff, sx: 6, sy: 6, op: 0.7 },      // M45
        { ko: '안드로메다 은하', ra: 0.712, dec: 41.269, color: 0xece7d6, sx: 12, sy: 4.5, op: 0.62 }, // M31
        { ko: '프레세페 성단', ra: 8.670, dec: 19.621, color: 0xd8e4ff, sx: 5, sy: 5, op: 0.55 },     // M44
        { ko: '헤르쿨레스 성단', ra: 16.695, dec: 36.460, color: 0xece4ca, sx: 4.5, sy: 4.5, op: 0.55 }, // M13
        { ko: '석호성운', ra: 18.060, dec: -24.38, color: 0xff9bb0, sx: 6, sy: 5, op: 0.65 }          // M8
    ];
    const glowTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    DEEPSKY.forEach(o => {
        const p = raDecToVec(o.ra, o.dec);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: o.color, transparent: true, opacity: o.op, depthWrite: false, blending: THREE.AdditiveBlending }));
        spr.position.set(p[0], p[1], p[2]).multiplyScalar(0.98);
        spr.scale.set(o.sx, o.sy, 1);
        constGroup.add(spr);
        const lab = constLabel(o.ko);
        lab.material.opacity = 0.42;
        lab.scale.set(11, 2.8, 1);
        lab.position.set(p[0], p[1] - 5, p[2]).multiplyScalar(0.965);
        constGroup.add(lab);
    });

    constGroup.visible = false;
    scene.add(constGroup);
    const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.06, 32, 20),
        new THREE.MeshBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.07, depthWrite: false })
    );
    atmo.visible = false;
    scene.add(atmo);

    let isSpace = false;
    function applyTheme(space) {
        isSpace = space;
        skyRefs.sky.visible = !space;
        skyRefs.sunSpr.visible = !space;
        stars.visible = space;
        constGroup.visible = space;
        atmo.visible = space;
        shimmer.visible = !space;
        cloudPivots.forEach(c => { c.pivot.visible = !space; });
        planet.material.color.set(space ? 0x525f78 : 0xffffff);
        hemiL.color.set(space ? 0x3a4a8a : 0xd8f2e6);
        hemiL.groundColor.set(space ? 0x1a1626 : 0xc9b28e);
        hemiL.intensity = space ? 0.55 : 0.7;
        sun.color.set(space ? 0x9fb4ff : 0xffe9c4);
        sun.intensity = space ? 0.55 : 1.2;
        ambL.color.set(space ? 0x2a3050 : 0xfff4e0);
        ambL.intensity = space ? 0.5 : 0.32;
        SPOT_DEFS.forEach(s => {
            if (s.signBoard) {
                s.signBoard.material.map = space ? s.nightTex : s.dayTex;
                s.signBoard.material.needsUpdate = true;
            }
        });
        applyAudioTheme(space);
    }

    /* ---------- 현재 시각에 맞춰 낮/밤 자동 전환 (실시간) ---------- */
    let realNight = null;
    function isRealNight() {
        const h = new Date().getHours();
        return h < 6 || h >= 19;   // 밤: 19:00 ~ 05:59
    }
    function syncTimeTheme() {
        if (launchAnim) return;               // 로켓 발사 중엔 개입 안 함
        const night = isRealNight();
        if (night === realNight) return;      // 실제 낮↔밤이 바뀔 때만 전환(수동 로켓과 안 싸움)
        realNight = night;
        applyTheme(night);
    }
    setInterval(syncTimeTheme, 60000);        // 1분마다 실시간 확인 (초기 적용은 하단 init에서)

    /* ---------- 로켓 발사 시퀀스 ---------- */
    let launchAnim = null;
    function startLaunch() {
        if (launchAnim || !rocketParts) return;
        launchAnim = { t: 0, swapped: false };
        sfxLaunch();
    }

    /* ===== 사운드: 앰비언트(주변음) + SFX (WebAudio 합성, 오디오 파일 없음) ===== */
    let audioReady = false, audioOn = false;
    let sndMaster, sndDay, sndSpace, sndNoiseBuf;
    try { audioOn = localStorage.getItem('gghf-sound') === 'on'; } catch (e) {}

    function makeNoiseBuf() {
        const len = Math.floor(audioCtx.sampleRate * 2);
        const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02;   // 브라운 노이즈(저역 위주)
            d[i] = last * 3.2;
        }
        return buf;
    }
    function buildAudioGraph() {
        sndNoiseBuf = makeNoiseBuf();
        sndMaster = audioCtx.createGain(); sndMaster.gain.value = 0; sndMaster.connect(audioCtx.destination);
        sndDay = audioCtx.createGain(); sndDay.gain.value = 1; sndDay.connect(sndMaster);
        sndSpace = audioCtx.createGain(); sndSpace.gain.value = 0; sndSpace.connect(sndMaster);
        const now = audioCtx.currentTime;
        // 파도 — 느린 스웰
        const waves = audioCtx.createBufferSource(); waves.buffer = sndNoiseBuf; waves.loop = true;
        const waveLP = audioCtx.createBiquadFilter(); waveLP.type = 'lowpass'; waveLP.frequency.value = 480;
        const waveGain = audioCtx.createGain(); waveGain.gain.value = 0.06;
        const lfo = audioCtx.createOscillator(); lfo.frequency.value = 0.13;
        const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain); lfoGain.connect(waveGain.gain);
        waves.connect(waveLP); waveLP.connect(waveGain); waveGain.connect(sndDay);
        waves.start(now); lfo.start(now);
        // 바람 — 은은한 정상음
        const wind = audioCtx.createBufferSource(); wind.buffer = sndNoiseBuf; wind.loop = true;
        const windBP = audioCtx.createBiquadFilter(); windBP.type = 'bandpass'; windBP.frequency.value = 720; windBP.Q.value = 0.6;
        const windGain = audioCtx.createGain(); windGain.gain.value = 0.03;
        wind.connect(windBP); windBP.connect(windGain); windGain.connect(sndDay);
        wind.start(now);
        // 우주 드론 — 저음 디튠
        [58, 87].forEach((f, i) => {
            const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = i ? 6 : -6;
            const g = audioCtx.createGain(); g.gain.value = 0.05;
            o.connect(g); g.connect(sndSpace); o.start(now);
        });
        audioReady = true;
        scheduleChirp(); scheduleShimmer();
    }
    function startAmbient() {
        if (!audioOn || !document.body.classList.contains('in-village')) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioReady && audioCtx.state === 'running') return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (!audioReady) buildAudioGraph();
        updateAudioActive();
    }
    function updateAudioActive() {
        if (!audioReady || !sndMaster) return;
        const active = audioOn && document.body.classList.contains('in-village') && !document.hidden;
        const now = audioCtx.currentTime;
        sndMaster.gain.cancelScheduledValues(now);
        sndMaster.gain.setTargetAtTime(active ? 0.5 : 0, now, 0.4);
    }
    function applyAudioTheme(space) {
        if (!audioReady) return;
        const now = audioCtx.currentTime;
        sndDay.gain.setTargetAtTime(space ? 0 : 1, now, 0.8);
        sndSpace.gain.setTargetAtTime(space ? 1 : 0, now, 0.8);
    }
    function setAudioOn(on) {
        audioOn = on;
        try { localStorage.setItem('gghf-sound', on ? 'on' : 'off'); } catch (e) {}
        const btn = document.getElementById('v-sound');
        if (btn) { btn.textContent = on ? '🔊' : '🔇'; btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', on ? '섬 사운드 끄기' : '섬 사운드 켜기'); }
        if (on) startAmbient(); else updateAudioActive();
    }
    function scheduleChirp() {
        setTimeout(() => {
            if (!audioReady) return;
            if (audioOn && !isSpace && document.body.classList.contains('in-village') && !document.hidden) chirp();
            scheduleChirp();
        }, (2.5 + Math.random() * 5.5) * 1000);
    }
    function scheduleShimmer() {
        setTimeout(() => {
            if (!audioReady) return;
            if (audioOn && isSpace && document.body.classList.contains('in-village') && !document.hidden) shimmerBlip();
            scheduleShimmer();
        }, (4 + Math.random() * 7) * 1000);
    }
    function chirp() {
        if (!audioReady) return;
        const now = audioCtx.currentTime;
        const notes = 2 + (Math.random() * 3 | 0);
        const base = 1800 + Math.random() * 1400;
        for (let i = 0; i < notes; i++) {
            const o = audioCtx.createOscillator(); o.type = 'sine';
            const g = audioCtx.createGain();
            const tt = now + i * 0.09;
            o.frequency.setValueAtTime(base * (1 + i * 0.12 * (Math.random() < 0.5 ? 1 : -1)), tt);
            g.gain.setValueAtTime(0, tt);
            g.gain.linearRampToValueAtTime(0.05, tt + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, tt + 0.08);
            o.connect(g); g.connect(sndDay);
            o.start(tt); o.stop(tt + 0.1);
        }
    }
    function shimmerBlip() {
        if (!audioReady) return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(1200 + Math.random() * 1600, now);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.04, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        o.connect(g); g.connect(sndSpace);
        o.start(now); o.stop(now + 1.5);
    }
    function sfxStep() {
        if (!audioReady || !audioOn) return;
        const now = audioCtx.currentTime;
        const src = audioCtx.createBufferSource(); src.buffer = sndNoiseBuf;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        src.connect(lp); lp.connect(g); g.connect(sndMaster);
        src.start(now, Math.random() * 1.5, 0.12);
    }
    function sfxTalk() {
        if (!audioReady || !audioOn) return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(520, now);
        o.frequency.exponentialRampToValueAtTime(760, now + 0.06);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        o.connect(g); g.connect(sndMaster);
        o.start(now); o.stop(now + 0.13);
    }
    function sfxLaunch() {
        if (!audioReady || !audioOn) return;
        const now = audioCtx.currentTime;
        const src = audioCtx.createBufferSource(); src.buffer = sndNoiseBuf; src.loop = true;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(120, now);
        lp.frequency.linearRampToValueAtTime(900, now + 1.0);
        lp.frequency.linearRampToValueAtTime(150, now + 2.1);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.22, now + 0.5);
        g.gain.setValueAtTime(0.22, now + 1.4);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
        src.connect(lp); lp.connect(g); g.connect(sndMaster);
        src.start(now); src.stop(now + 2.3);
    }

    const hero = new THREE.Group();
    const bodyGrp = new THREE.Group();
    hero.add(bodyGrp);

    const shortsM = toon(C.shorts), skinM = toon(C.skin), shirtM = toon(C.shirt);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.26), shirtM);
    torso.position.y = 1.0;
    bodyGrp.add(torso);
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.2, 0.25), shortsM);
    shorts.position.y = 0.7;
    bodyGrp.add(shorts);

    function makeLeg(x) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.62, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 8), skinM);
        leg.position.y = -0.21;
        pivot.add(leg);
        const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.1, 8), toon(0xf5f2e8));
        sock.position.y = -0.47;
        pivot.add(sock);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), toon(0x3a3532));
        shoe.position.set(0, -0.565, -0.03);
        pivot.add(shoe);
        bodyGrp.add(pivot);
        return pivot;
    }
    function makeArm(x) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 1.16, 0);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 8), shirtM);
        sleeve.position.y = -0.06;
        pivot.add(sleeve);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.3, 8), skinM);
        arm.position.y = -0.27;
        pivot.add(arm);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinM);
        hand.position.y = -0.43;
        pivot.add(hand);
        bodyGrp.add(pivot);
        return pivot;
    }
    const legL = makeLeg(-0.1), legR = makeLeg(0.1);
    const armL = makeArm(-0.25), armR = makeArm(0.25);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 14), skinM);
    head.position.y = 1.44;
    bodyGrp.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), toon(C.hair));
    hair.position.set(0, 1.49, 0.045);
    hair.scale.set(1, 0.92, 1);
    bodyGrp.add(hair);
    [-0.065, 0.065].forEach(x => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), toon(0x2a2320));
        eye.position.set(x, 1.455, -0.172);
        bodyGrp.add(eye);
    });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.03), toon(0x8a6a48));
    strap.position.set(0.02, 1.04, -0.145);
    strap.rotation.z = 0.62;
    bodyGrp.add(strap);
    const strapBack = strap.clone();
    strapBack.position.z = 0.145;
    bodyGrp.add(strapBack);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.11), toon(0xa3814f));
    bag.position.set(-0.24, 0.82, 0.06);
    bag.rotation.z = 0.1;
    bodyGrp.add(bag);
    const bagFlap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.12), toon(0x8a6a48));
    bagFlap.position.set(-0.24, 0.885, 0.06);
    bagFlap.rotation.z = 0.1;
    bodyGrp.add(bagFlap);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshBasicMaterial({ color: 0x1e2a24, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    hero.add(shadow);
    scene.add(hero);

    const puffs = [];
    for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 8), new THREE.MeshBasicMaterial({ color: 0xf7efdc, transparent: true, opacity: 0, depthWrite: false }));
        m.visible = false;
        scene.add(m);
        puffs.push({ m, life: 0 });
    }
    let puffIdx = 0;
    const _puffUp = new THREE.Vector3(), _puffAxis = new THREE.Vector3(0, 0, 1);
    function spawnPuffAt(pos, s0 = 0.14) {
        const p = puffs[puffIdx];
        puffIdx = (puffIdx + 1) % puffs.length;
        p.life = 0.45;
        p.s0 = s0;
        p.m.visible = true;
        _puffUp.copy(pos).normalize();
        p.m.position.copy(pos).addScaledVector(_puffUp, 0.035);
        p.m.quaternion.setFromUnitVectors(_puffAxis, _puffUp);
    }
    function spawnPuff() { spawnPuffAt(hero.position, 0.14); }

    /* ================= 자율 NPC — 나의 다른 페르소나들 (GTA풍 배회) ================= */
    const AI_NPC_RULES = '너는 GGHF 작은 행성 3D 월드를 배회하는 AI 에이전트 NPC다. 항상 한국어로, 1~2문장의 짧은 구어체로만 답한다. 마크다운이나 목록, 코드블록은 쓰지 않는다. 캐릭터를 유지한다.';
    const PERSONA_DEFS = [
        { name: '최경환',       role: 'GAME DEVELOPER', color: '#12a5b8', shirt: 0x2e8b83, shorts: 0x274652, hair: 0x2a2622, skin: 0xedc39b,
          lines: ['안녕, 나도 최경환의 한 조각이야.', '게임과 개발 실험을 이 작은 행성에 모아뒀어. 위쪽 작품 메뉴에서도 바로 볼 수 있어.', 'GitHub에 오면 더 많은 실험을 볼 수 있어.'],
          link: 'https://github.com/emptypizza', linkLabel: 'GitHub 열기 (E)' },
        { name: '인디 대표',    role: 'GGHF FOUNDER',   color: '#b5453c', shirt: 0xb5453c, shorts: 0x3d4660, hair: 0x1f1a17, skin: 0xf0c9a0,
          lines: ['난 GGHF라는 인디 게임 스튜디오를 운영해.', 'itch.io에 프로토타입부터 출시작까지 다 올려뒀어.'],
          link: 'https://gghf.itch.io', linkLabel: 'GGHF itch.io 열기 (E)' },
        { name: '바이브코더',   role: 'AI VIBECODING',  color: '#b98f2f', shirt: 0xd9a441, shorts: 0x4a4030, hair: 0x2a2622, skin: 0xe8bd94,
          lines: ['요즘은 클로드로 하루 만에 프로토타입을 뽑고 있어.', '현업 게임인끼리 AI 시행착오를 나누는 강남 오프라인 스터디를 열어.', '너도 한번 바이브코딩 해볼래?'],
          link: content.study.url, linkLabel: '참여 문의 (E)' },
        { name: '도트 아티스트', role: 'PIXEL ARTIST',   color: '#c76a9e', shirt: 0xc76a9e, shorts: 0x5a3550, hair: 0x3a2a44, skin: 0xf2cfa6,
          lines: ['섬의 텍스처는 캔버스로 그려져 있어. 나무와 집을 가까이서 둘러봐.', '종이 영웅들(PAPER HEROES)도 내 손끝에서 태어나는 중이지.'] },
        { name: '사운드 메이커', role: 'CHIPTUNE',       color: '#5a63a8', shirt: 0x5a63a8, shorts: 0x2f3560, hair: 0x201d2e, skin: 0xecc199,
          lines: ['게임 속 삑삑대는 효과음? 오실레이터로 실시간 합성한 거야.', '칩튠 8비트가 내 언어지. 🎵'] },
        { name: '게임 기획자',  role: 'GAME DESIGNER',  color: '#c9773b', shirt: 0xc9773b, shorts: 0x4a3a2a, hair: 0x2a2320, skin: 0xefc79c,
          lines: ['두 로봇이 똑같이 움직이는 듀얼 퍼즐, NEMO_D.O를 기획했어.', '프로젝트 페이지에서 지금 공개된 버전을 확인할 수 있어.'],
          link: 'https://play.google.com/store/apps/details?id=com.GGHF.Nemo_DO', linkLabel: 'Google Play 열기 (E)' },
        /* --- AI 에이전트 로봇 (Puter.js 실제 LLM 대화, lines는 첫 인사 + 폴백 대사) --- */
        { name: '클로드봇',       role: 'ANTHROPIC UNIT', color: '#d97757', accent: 0xd97757, eye: 0xffb37a, isAI: true, model: 'claude-haiku-4-5',
          systemPrompt: AI_NPC_RULES + ' 너는 클로드봇 — Anthropic의 Claude를 모티브로 한 사려 깊고 정중한 로봇이다. 차분하게 도움 주는 걸 좋아한다.',
          lines: ['안녕, 난 클로드봇이야. 아래 입력창에 아무거나 물어봐!', '지금은 회로가 좀 느리네… 잠시 후 다시 물어봐 줘.', 'AI 대화가 안 되면 Puter 로그인이 필요한 걸 수도 있어.'] },
        { name: 'GPT 드로이드',   role: 'OPENAI CORE',    color: '#10a37f', accent: 0x10a37f, eye: 0x54e6c8, isAI: true, model: 'gpt-5-nano',
          systemPrompt: AI_NPC_RULES + ' 너는 GPT 드로이드 — 활발하고 박식한 수다쟁이 로봇이다. 어떤 주제든 신나서 대답한다.',
          lines: ['삐빅! GPT 드로이드 가동 중. 뭐든 물어봐!', '신호가 약하네… 조금 있다가 다시 얘기하자.', '대화 모듈 점검 중이야. Puter 로그인이 필요할 수도!'] },
        { name: '제미나이 센트리', role: 'GEMINI PROBE',   color: '#5b6ff0', accent: 0x5b6ff0, eye: 0x9fb4ff, isAI: true,
          systemPrompt: AI_NPC_RULES + ' 너는 제미나이 센트리 — 호기심 많은 탐사 드론이다. 이 행성과 우주를 관찰하는 게 취미고, 가끔 관측 데이터를 인용하듯 말한다.',
          lines: ['관측 개시. 흥미로운 생명체 발견! 말을 걸어줘.', '통신 감도가 낮아… 재접속을 시도해 줘.', '데이터 링크 오프라인. Puter 로그인 후 다시 시도해 줘.'] },
        /* --- 제보 드론 (LLM 아님. 입력을 Trello 인박스로 전달) --- */
        { name: '제보 드론', role: 'REPORT DRONE', color: '#00e5ff', accent: 0x00e5ff, eye: 0x9ff4ff,
          isFeedback: true,
          lines: ['삐- 제보 드론이야. 게임하다 아쉬웠던 거 아무거나 적어줘, 개발자 보드로 바로 꽂아줄게.'] }
    ];

    function makeNameTag(name, role, accent) {
        const W = 340, H = 120;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(18,24,38,0.9)';
        g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 24); g.fill();
        g.lineWidth = 4; g.strokeStyle = accent;
        g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 24); g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'middle';
        let fs = 46;
        g.font = `bold ${fs}px "Apple SD Gothic Neo", "Trebuchet MS", sans-serif`;
        while (g.measureText(name).width > W - 48 && fs > 22) {
            fs -= 2; g.font = `bold ${fs}px "Apple SD Gothic Neo", "Trebuchet MS", sans-serif`;
        }
        g.fillStyle = '#f5f8ff';
        g.fillText(name, W / 2, 48);
        g.fillStyle = accent;
        g.font = 'bold 22px "Trebuchet MS", sans-serif';
        g.fillText(role, W / 2, 90);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        spr.scale.set(2.0, 0.706, 1);
        return spr;
    }

    function makePersona(p) {
        const grp = new THREE.Group();
        const bodyGrp = new THREE.Group();
        grp.add(bodyGrp);
        const shirtM = toon(p.shirt), shortsM = toon(p.shorts), skinM = toon(p.skin), hairM = toon(p.hair);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.26), shirtM);
        torso.position.y = 1.0; bodyGrp.add(torso);
        const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.2, 0.25), shortsM);
        shortsMesh.position.y = 0.7; bodyGrp.add(shortsMesh);
        const mkLeg = x => {
            const pv = new THREE.Group(); pv.position.set(x, 0.62, 0);
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 8), skinM);
            leg.position.y = -0.21; pv.add(leg);
            const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), toon(0x3a3532));
            shoe.position.set(0, -0.5, -0.03); pv.add(shoe);
            bodyGrp.add(pv); return pv;
        };
        const mkArm = x => {
            const pv = new THREE.Group(); pv.position.set(x, 1.16, 0);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.34, 8), shirtM);
            arm.position.y = -0.19; pv.add(arm);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinM);
            hand.position.y = -0.4; pv.add(hand);
            bodyGrp.add(pv); return pv;
        };
        const legL = mkLeg(-0.1), legR = mkLeg(0.1);
        const armL = mkArm(-0.25), armR = mkArm(0.25);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12), skinM);
        head.position.y = 1.44; bodyGrp.add(head);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), hairM);
        hair.position.set(0, 1.49, 0.045); hair.scale.set(1, 0.92, 1); bodyGrp.add(hair);
        [-0.065, 0.065].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), toon(0x2a2320));
            eye.position.set(x, 1.455, -0.172); bodyGrp.add(eye);
        });
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshBasicMaterial({ color: 0x1e2a24, transparent: true, opacity: 0.26, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; grp.add(shadow);
        const label = makeNameTag(p.name, p.role, p.color);
        label.position.y = 2.32; grp.add(label);
        return { grp, bodyGrp, legL, legR, armL, armR };
    }

    /* AI 로봇 외형 — makePersona와 동일한 피벗 구조/반환 계약(updateNPCs가 legL/R·armL/R rotation.x를 구동) */
    const ROBOT_BODY = 0x9aa4b0, ROBOT_HEAD = 0xb8c0ca, ROBOT_DARK = 0x5c6470;
    const robotEyeGeo = new THREE.BoxGeometry(0.055, 0.035, 0.02);
    const robotAntGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6);
    const robotBallGeo = new THREE.SphereGeometry(0.035, 8, 8);
    function makeRobot(p) {
        const grp = new THREE.Group();
        const bodyGrp = new THREE.Group();
        grp.add(bodyGrp);
        const bodyM = toon(ROBOT_BODY), headM = toon(ROBOT_HEAD), darkM = toon(ROBOT_DARK), accentM = toon(p.accent);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.28), bodyM);
        torso.position.y = 1.0; bodyGrp.add(torso);
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), accentM);
        chest.position.set(0, 1.04, -0.15); bodyGrp.add(chest);
        const hips = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.26), darkM);
        hips.position.y = 0.7; bodyGrp.add(hips);
        const mkLeg = x => {
            const pv = new THREE.Group(); pv.position.set(x, 0.62, 0);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), bodyM);
            leg.position.y = -0.21; pv.add(leg);
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), darkM);
            foot.position.set(0, -0.5, -0.03); pv.add(foot);
            bodyGrp.add(pv); return pv;
        };
        const mkArm = x => {
            const pv = new THREE.Group(); pv.position.set(x, 1.16, 0);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), bodyM);
            arm.position.y = -0.19; pv.add(arm);
            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.11), darkM);
            hand.position.y = -0.4; pv.add(hand);
            bodyGrp.add(pv); return pv;
        };
        const legL = mkLeg(-0.1), legR = mkLeg(0.1);
        const armL = mkArm(-0.25), armR = mkArm(0.25);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.3), headM);
        head.position.y = 1.44; bodyGrp.add(head);
        const eyeM = new THREE.MeshBasicMaterial({ color: p.eye });
        [-0.07, 0.07].forEach(x => {
            const eye = new THREE.Mesh(robotEyeGeo, eyeM);
            eye.position.set(x, 1.46, -0.16); bodyGrp.add(eye);
        });
        const pole = new THREE.Mesh(robotAntGeo, darkM);
        pole.position.y = 1.7; bodyGrp.add(pole);
        const ball = new THREE.Mesh(robotBallGeo, new THREE.MeshBasicMaterial({ color: p.accent }));
        ball.position.y = 1.82; bodyGrp.add(ball);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshBasicMaterial({ color: 0x1e2a24, transparent: true, opacity: 0.26, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; grp.add(shadow);
        const label = makeNameTag(p.name, p.role, p.color);
        label.position.y = 2.32; grp.add(label);
        return { grp, bodyGrp, legL, legR, armL, armR };
    }

    const PERSON_R = 0.62, HERO_SHARE = 0.45, NPC_SHARE = 0.55;
    const NPCS = [];
    for (const persona of PERSONA_DEFS) {
        if (persona.name === '게임 기획자') { persona.lines = [projects.nemo.description, '프로젝트 페이지에서 공개 버전을 확인해 줘.']; persona.link = projects.nemo.url; }
        if (persona.name === '도트 아티스트') persona.lines = ['섬의 텍스처는 캔버스로 그려져 있어.', projects.paper.description];
        if (persona.name === '바이브코더') { persona.lines = [content.study.description, '스터디 안내 페이지에서 최신 소식을 확인해 줘.']; persona.link = content.study.url; }
    }

    function npcPickTarget(n) {
        for (let i = 0; i < 12; i++) {
            let tl, ta;
            if (Math.random() < 0.45) {
                const s = SPOT_DEFS[(Math.random() * SPOT_DEFS.length) | 0];
                tl = wrapLon(s.lon + rand(-0.22, 0.22));
                ta = Math.max(-LAT_MAX, Math.min(LAT_MAX, s.lat + rand(-0.12, 0.12)));
            } else {
                tl = rand(-Math.PI, Math.PI);
                ta = (Math.random() < 0.5 ? 1 : -1) * rand(0.05, 0.3);
            }
            if (Math.abs(wrapLon(tl - INLET_LON)) < 0.16) continue;
            n.tLon = tl; n.tLat = ta; return;
        }
        n.tLon = n.lon; n.tLat = n.lat;
    }

    PERSONA_DEFS.forEach((p, i) => {
        const built = (p.isAI || p.isFeedback) ? makeRobot(p) : makePersona(p);
        scene.add(built.grp);
        const n = {
            persona: p,
            grp: built.grp, bodyGrp: built.bodyGrp,
            legL: built.legL, legR: built.legR, armL: built.armL, armR: built.armR,
            lon: wrapLon((-140 + i * 47) * D2R),
            lat: (i % 2 ? 1 : -1) * rand(0.1, 0.24),
            heading: rand(-Math.PI, Math.PI),
            speed: rand(2.0, 3.0),
            state: 'walk', timer: rand(2, 6),
            walkBlend: 0, walkPhase: rand(0, 6.28), bornPhase: rand(0, 6.28),
            tLon: 0, tLat: 0
        };
        npcPickTarget(n);
        NPCS.push(n);
    });

    const _nUp = new THREE.Vector3(), _nEast = new THREE.Vector3(), _nNorth = new THREE.Vector3(), _nFace = new THREE.Vector3();
    function updateNPCs(dt, t) {
        for (const n of NPCS) {
            n.timer -= dt;
            let moving = false;
            const nearPlayer = Math.hypot(wrapLon(heroLon - n.lon) * Math.max(0.3, Math.cos(n.lat)), heroLat - n.lat) * R < TALK_R;
            if (n === talkingNPC || (n === nearNPC && nearPlayer)) {
                // 대화 중: 배회 정지 + 플레이어를 바라봄
                const dl = wrapLon(heroLon - n.lon) * Math.max(0.3, Math.cos(n.lat)), da = heroLat - n.lat;
                if (Math.hypot(dl, da) > 1e-5) {
                    n.heading += wrapLon(Math.atan2(dl, da) - n.heading) * (1 - Math.exp(-9 * dt));
                    n.heading = wrapLon(n.heading);
                }
            } else if (n.state === 'walk') {
                const dLon = wrapLon(n.tLon - n.lon), dLat = n.tLat - n.lat;
                const e = dLon * Math.max(0.3, Math.cos(n.lat)), nn = dLat;
                const L = Math.hypot(e, nn);
                if (L * R < 0.6 || n.timer <= 0) {
                    n.state = 'idle'; n.timer = rand(1.2, 3.8);
                } else {
                    const eastAmt = e / L, northAmt = nn / L;
                    const step = n.speed * dt;
                    n.lon += (eastAmt * step) / (R * Math.max(0.3, Math.cos(n.lat)));
                    n.lat += (northAmt * step) / R;
                    const targetHeading = Math.atan2(eastAmt, northAmt);
                    n.heading += wrapLon(targetHeading - n.heading) * (1 - Math.exp(-9 * dt));
                    n.heading = wrapLon(n.heading);
                    moving = true;
                }
            } else if (n.timer <= 0) {
                n.state = 'walk'; n.timer = rand(3, 8); npcPickTarget(n);
            }

            // 플레이어와 충돌: NPC(자기 몫)와 플레이어(상대 몫)를 서로 밀어냄 — 관통 방지
            {
                const cosMid = Math.max(0.3, Math.cos((n.lat + heroLat) / 2));
                const dl = wrapLon(n.lon - heroLon) * cosMid, da = n.lat - heroLat;
                const h = Math.hypot(dl, da);
                if (h * R < PERSON_R && h > 1e-6) {
                    const push = (PERSON_R - h * R) / R, inv = 1 / h;
                    n.lon += (dl * inv * push * NPC_SHARE) / cosMid;
                    n.lat += da * inv * push * NPC_SHARE;
                    heroLon -= (dl * inv * push * HERO_SHARE) / cosMid;
                    heroLat -= da * inv * push * HERO_SHARE;
                    n.timer = Math.min(n.timer, 0.35);
                }
            }

            for (const c of colliders) {
                const cosMid = Math.max(0.3, Math.cos((n.lat + c.lat) / 2));
                const dl = wrapLon(n.lon - c.lon) * cosMid, da = n.lat - c.lat;
                const dist = Math.hypot(dl, da) * R;
                if (dist < c.keep && dist > 1e-5) {
                    const push = (c.keep - dist) / R, inv = 1 / Math.hypot(dl, da);
                    n.lon += (dl * inv * push) / cosMid;
                    n.lat += da * inv * push;
                    n.timer = Math.min(n.timer, 0.35);
                }
            }

            n.lon = wrapLon(n.lon);
            n.lat = Math.max(-LAT_MAX, Math.min(LAT_MAX, n.lat));

            n.walkBlend += ((moving ? 1 : 0) - n.walkBlend) * (1 - Math.exp(-9 * dt));

            const lift = Math.abs(n.lat) < 0.06 ? bridgeLift(n.lon) : 0;
            planetBasis(n.lon, n.lat, _nUp, _nEast, _nNorth);
            _nFace.copy(_nNorth).multiplyScalar(Math.cos(n.heading)).addScaledVector(_nEast, Math.sin(n.heading));
            orientOnPlanet(n.grp, n.lon, n.lat, _nFace, lift);

            n.walkPhase += dt * 10.5 * n.walkBlend;
            const s = Math.sin(n.walkPhase);
            n.legL.rotation.x = s * 0.78 * n.walkBlend;
            n.legR.rotation.x = -s * 0.78 * n.walkBlend;
            n.armL.rotation.x = -s * 0.5 * n.walkBlend;
            n.armR.rotation.x = s * 0.5 * n.walkBlend;
            n.bodyGrp.position.y = (1 - Math.cos(n.walkPhase * 2)) * 0.033 * n.walkBlend
                + (reducedMotion ? 0 : Math.sin(t * 1.7 + n.bornPhase) * 0.008);
            n.bodyGrp.rotation.z = Math.sin(n.walkPhase) * 0.045 * n.walkBlend;
        }
    }

    /* ================= 동물들 — 새·토끼·나비 (앰비언트) ================= */
    const _aUp = new THREE.Vector3(), _aE = new THREE.Vector3(), _aN = new THREE.Vector3(), _aF = new THREE.Vector3();

    // 하늘의 새 (구름처럼 선회 + 날갯짓)
    const birds = [];
    function makeBird() {
        const col = [0x3a3f4a, 0x4a4038, 0x2e2b2b][(Math.random() * 3) | 0];
        const m = toon(col);
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m);
        body.scale.set(0.7, 0.6, 1.5); g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), m);
        head.position.set(0, 0.03, 0.23); g.add(head);
        const wg = new THREE.BoxGeometry(0.92, 0.04, 0.34);
        const wingL = new THREE.Mesh(wg, m); wingL.position.x = -0.46;
        const wingR = new THREE.Mesh(wg, m); wingR.position.x = 0.46;
        g.add(wingL, wingR);
        g.rotation.y = Math.PI / 2;  // 전방(+Z) → 궤도 접선(+X)
        return { g, wingL, wingR };
    }
    for (let i = 0; i < 7; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.set(rand(-0.6, 0.6), rand(0, Math.PI * 2), rand(-0.5, 0.5));
        const b = makeBird();
        b.g.scale.setScalar(rand(0.55, 1.0));
        b.g.position.set(0, 0, R + rand(2.4, 5.2));
        pivot.add(b.g);
        scene.add(pivot);
        birds.push({ pivot, wingL: b.wingL, wingR: b.wingR, speed: rand(0.06, 0.13) * (Math.random() < 0.5 ? 1 : -1), flap: rand(0, 6.28), flapSpd: rand(9, 14) });
    }

    // 풀밭의 토끼 (앉기 ↔ 깡총 이동)
    const critters = [];
    function makeRabbit() {
        const fur = [0xf3ead6, 0xd9c7a8, 0xbfa98a][(Math.random() * 3) | 0];
        const m = toon(fur);
        const grp = new THREE.Group();
        const bodyGrp = new THREE.Group(); grp.add(bodyGrp);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), m);
        body.scale.set(1, 0.9, 1.25); body.position.y = 0.16; bodyGrp.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 7), m);
        head.position.set(0, 0.27, -0.16); bodyGrp.add(head);
        [-0.045, 0.045].forEach(x => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.17, 0.03), m);
            ear.position.set(x, 0.42, -0.17); ear.rotation.x = -0.18; bodyGrp.add(ear);
        });
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), toon(0xffffff));
        tail.position.set(0, 0.17, 0.2); bodyGrp.add(tail);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), new THREE.MeshBasicMaterial({ color: 0x1e2a24, transparent: true, opacity: 0.22, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; grp.add(shadow);
        return { grp, bodyGrp };
    }
    let rPlaced = 0, rGuard = 0;
    while (rPlaced < 5 && rGuard++ < 300) {
        const lon = rand(-Math.PI, Math.PI);
        const lat = (Math.random() < 0.5 ? 1 : -1) * rand(0.08, 0.26);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.2) continue;
        if (!farFromAll(lon, lat, 1.4)) continue;
        const r = makeRabbit();
        scene.add(r.grp);
        critters.push({ grp: r.grp, bodyGrp: r.bodyGrp, lon, lat, heading: rand(-Math.PI, Math.PI), state: 'sit', timer: rand(0.8, 3), hopT: 0, speed: rand(1.3, 2.1) });
        rPlaced++;
    }

    // 나비 (꽃밭 위 팔랑)
    const flutters = [];
    const flutterCols = [0xff8ac0, 0xffd54f, 0x9fd3ff, 0xff7a5a, 0xc79bff];
    for (let i = 0, made = 0, guard = 0; made < 5 && guard < 200; guard++) {
        const lon = rand(-Math.PI, Math.PI);
        if (Math.abs(wrapLon(lon - INLET_LON)) < 0.18) continue;
        const lat = (Math.random() < 0.5 ? 1 : -1) * rand(0.05, 0.2);
        const grp = new THREE.Group();
        const bodyGrp = new THREE.Group(); grp.add(bodyGrp);
        const m = new THREE.MeshBasicMaterial({ color: flutterCols[made % flutterCols.length], side: THREE.DoubleSide });
        const wg = new THREE.PlaneGeometry(0.13, 0.17);
        const hingeL = new THREE.Group(), hingeR = new THREE.Group();
        const wingL = new THREE.Mesh(wg, m); wingL.position.x = -0.075; hingeL.add(wingL);
        const wingR = new THREE.Mesh(wg, m); wingR.position.x = 0.075; hingeR.add(wingR);
        bodyGrp.add(hingeL, hingeR);
        scene.add(grp);
        flutters.push({ grp, bodyGrp, hingeL, hingeR, lon, lat, phase: rand(0, 6.28), rise: rand(0.4, 0.85) });
        made++;
    }

    function updateAnimals(dt, t) {
        for (const b of birds) {
            b.pivot.rotateY(b.speed * dt);
            b.flap += dt * b.flapSpd;
            const a = Math.sin(b.flap) * 0.7;
            b.wingL.rotation.z = a; b.wingR.rotation.z = -a;
        }
        for (const c of critters) {
            c.timer -= dt;
            if (c.state === 'sit') {
                if (c.timer <= 0) {
                    if (Math.random() < 0.4) c.heading = wrapLon(c.heading + rand(-1.3, 1.3));
                    c.state = 'hop'; c.hopT = 0;
                }
                c.bodyGrp.position.y = 0; c.bodyGrp.rotation.x = 0;
            } else {
                c.hopT += dt / 0.45;
                if (c.hopT >= 1) {
                    c.state = 'sit'; c.timer = rand(0.6, 2.6); c.bodyGrp.position.y = 0; c.bodyGrp.rotation.x = 0;
                } else {
                    const step = c.speed * dt;
                    c.lon = wrapLon(c.lon + (Math.sin(c.heading) * step) / (R * Math.max(0.3, Math.cos(c.lat))));
                    c.lat = Math.max(-0.28, Math.min(0.28, c.lat + (Math.cos(c.heading) * step) / R));
                    c.bodyGrp.position.y = Math.sin(c.hopT * Math.PI) * 0.14;
                    c.bodyGrp.rotation.x = -Math.sin(c.hopT * Math.PI) * 0.3;
                }
            }
            planetBasis(c.lon, c.lat, _aUp, _aE, _aN);
            _aF.copy(_aN).multiplyScalar(Math.cos(c.heading)).addScaledVector(_aE, Math.sin(c.heading));
            orientOnPlanet(c.grp, c.lon, c.lat, _aF, 0);
        }
        for (const f of flutters) {
            const t2 = t * 1.3 + f.phase;
            orientOnPlanet(f.grp, f.lon + Math.sin(t2 * 0.7) * 0.012, f.lat + Math.sin(t2 * 0.9 + 1) * 0.008, null, 0);
            f.bodyGrp.position.y = f.rise + Math.sin(t2) * 0.12;
            const flap = 0.7 + Math.sin(t * 20 + f.phase) * 0.6;
            f.hingeL.rotation.y = -flap; f.hingeR.rotation.y = flap;
        }
    }

    let heroLon = -60 * D2R, heroLat = 0.0, heading = Math.PI / 2;
    let walkBlend = 0, walkPhase = 0, prevStep = 0;

    const keys = {};
    const KEYMAP = {
        KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
    };
    addEventListener('keydown', e => {
        const inV = document.body.classList.contains('in-village');
        if (e.isComposing || !inV) return;
        if (e.code === 'Escape') { e.preventDefault(); if (talkingNPC) { endTalk(); renderer.domElement.focus(); } else leaveVillage(false); return; }
        if (document.activeElement === vpInput) return;
        const a = KEYMAP[e.code];
        if (a) { keys[a] = true; e.preventDefault(); return; }
        if (e.code === 'KeyE') { e.preventDefault(); doAction(); }
    }, true);
    addEventListener('keyup', e => {
        const a = KEYMAP[e.code];
        if (a) {
            keys[a] = false;
            if (document.body.classList.contains('in-village')) e.preventDefault();
        }
    }, true);
    addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = false; });

    const joy = document.getElementById('v-joy'), stick = document.getElementById('v-stick');
    let jv = { x: 0, z: 0 }, jid = null;
    const setStick = (x, z) => { stick.style.transform = `translate(${x * 34}px, ${z * 34}px)`; };
    function moveJoy(e) {
        const r = joy.getBoundingClientRect();
        let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dz = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const m = Math.hypot(dx, dz) || 1;
        if (m > 1) { dx /= m; dz /= m; }
        jv = { x: dx, z: dz };
        setStick(dx, dz);
    }
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); moveJoy(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) moveJoy(e); });
    const endJoy = e => { if (e.pointerId === jid) { jid = null; jv = { x: 0, z: 0 }; setStick(0, 0); } };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);

    const panel = document.getElementById('v-panel');
    const pAct = document.getElementById('v-act');
    const btnE = document.getElementById('v-int');
    const fadeEl = document.getElementById('v-fade');
    let nearSpot = null;
    let nearNPC = null, talkingNPC = null, talkLine = 0;
    const TALK_R = 2.4;

    function pauseInlineGame() { window.GGHF_GAME?.pause('island'); }
    function startLoop() { clock.getDelta(); renderer.setAnimationLoop(tick); }
    function stopLoop() { renderer.setAnimationLoop(null); }
    function leaveVillage(toPlay) {
        stopLoop();
        keys.up = keys.down = keys.left = keys.right = false;
        jv = { x: 0, z: 0 };
        setStick(0, 0);
        document.body.classList.remove('in-village');
        endTalk();
        window.GGHF_HUB?.restoreFocus(toPlay === true ? 'play' : typeof toPlay === 'string' ? toPlay : null);
        updateAudioActive();
    }
    function enterVillage() {
        pauseInlineGame();
        document.body.classList.add('in-village');
        panel.classList.remove('show');
        nearSpot = null; nearNPC = null; talkingNPC = null; talkLine = 0;
        camReady = false;
        orientOnPlanet(hero, heroLon, heroLat, _heroFace);
        updateCamera(null);
        startLoop();
        renderer.domElement.focus({ preventScroll: true });
        updateAudioActive();
    }
    function doAction() {
        if (!document.body.classList.contains('in-village') || launchAnim) return;
        if (talkingNPC) {
            if (talkingNPC.persona.isFeedback && !content.feedback.enabled) { leaveVillage('contact'); return; }
            if (talkingNPC.persona.isAI || talkingNPC.persona.isFeedback) { endTalk(); renderer.domElement.focus(); return; }
            const lines = talkingNPC.persona.lines || [];
            if (talkLine < lines.length - 1) { talkLine++; renderTalkLine(); sfxTalk(); }
            else { const link = talkingNPC.persona.link; endTalk(); if (link) window.open(link, '_blank', 'noopener'); }
            return;
        }
        if (nearNPC) { startTalk(nearNPC); return; }
        if (!nearSpot) return;
        if (nearSpot.launch) startLaunch();
        else if (nearSpot.play) leaveVillage(true);
        else if (nearSpot.link) window.open(nearSpot.link, '_blank', 'noopener');
    }
    pAct.onclick = doAction;
    btnE.onclick = doAction;
    document.getElementById('v-menu').onclick = () => leaveVillage(false);

    const sndBtn = document.getElementById('v-sound');
    if (sndBtn) { sndBtn.textContent = audioOn ? '🔊' : '🔇'; sndBtn.setAttribute('aria-pressed', String(audioOn)); sndBtn.setAttribute('aria-label', audioOn ? '섬 사운드 끄기' : '섬 사운드 켜기'); sndBtn.onclick = () => setAudioOn(!audioOn); }
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'].forEach(ev => addEventListener(ev, startAmbient, { passive: true }));

    const _hpN = new THREE.Vector3(), _spN = new THREE.Vector3();
    function showPanel(o) {
        document.getElementById('vp-kor').textContent = o.kor || '';
        document.getElementById('vp-sub').textContent = o.sub || '';
        document.getElementById('vp-desc').textContent = o.desc || '';
        const bEl = document.getElementById('vp-badge');
        bEl.textContent = o.badge || '';
        bEl.style.display = o.badge ? 'block' : 'none';
        if (o.color) panel.style.borderTopColor = o.color;
        if (o.ai) panel.classList.add('ai-chat');
        else { vpChat.textContent = ''; vpInput.value = ''; panel.classList.remove('ai-chat'); }
        if (o.actLabel) {
            pAct.textContent = o.actLabel;
            pAct.style.display = 'inline-block';
            if (matchMedia('(pointer: coarse), (max-width: 760px)').matches) btnE.style.display = 'block';
        } else {
            pAct.style.display = 'none';
            btnE.style.display = 'none';
        }
        panel.classList.add('show');
    }
    function hidePanel() { panel.classList.remove('show'); btnE.style.display = 'none'; }
    function renderTalkLine() {
        const p = talkingNPC.persona, lines = p.lines || [];
        const last = talkLine >= lines.length - 1;
        const actLabel = last ? (p.link ? p.linkLabel : '닫기 (E)') : '다음 (E)';
        showPanel({ kor: p.name, sub: p.role, desc: lines[talkLine] || '', color: p.color, actLabel });
    }
    function startTalk(n) {
        if (n.persona.isFeedback) { openFeedbackChat(n); return; }
        if (n.persona.isAI) { openAiChat(n); return; }
        talkingNPC = n; talkLine = 0; renderTalkLine(); sfxTalk();
    }
    function endTalk() {
        if (talkingNPC) { talkingNPC.timer = 0.3; talkingNPC.canceled = true; }
        talkingNPC = null; talkLine = 0; nearSpot = null; nearNPC = null;
        resetAiChat();
        hidePanel();
    }

    /* ---- AI 에이전트 NPC — Puter.js LLM 채팅 (실패/미로그인 시 lines 폴백) ---- */
    const vpChat = document.getElementById('vp-chat');
    const vpForm = document.getElementById('vp-chatform');
    const vpInput = document.getElementById('vp-input');
    const vpSend = document.getElementById('vp-send');
    const AI_DEFAULT_MODEL = 'gpt-5-nano';
    function chatBubble(cls, text) {
        const d = document.createElement('div');
        d.className = 'msg ' + cls;
        d.textContent = text;
        vpChat.appendChild(d);
        vpChat.scrollTop = vpChat.scrollHeight;
        return d;
    }
    function resetAiChat() {
        vpForm.hidden = false;
        document.getElementById('vp-ai-notice').hidden = true;
        vpChat.textContent = '';
        vpInput.value = '';
        vpInput.blur();
        vpSend.disabled = false;
        panel.classList.remove('ai-chat');
    }
    function stopMovement() { keys.up = keys.down = keys.left = keys.right = false; jv = { x: 0, z: 0 }; setStick(0, 0); }
    vpInput.addEventListener('focus', stopMovement);
    function openAiChat(n) {
        stopMovement();
        vpForm.hidden = false;
        document.getElementById('vp-ai-notice').hidden = false;
        talkingNPC = n;
        if (!n.messages) n.messages = [{ role: 'system', content: n.persona.systemPrompt }];
        n.canceled = false;
        n.fallbackIdx = n.fallbackIdx || 0;
        showPanel({ kor: n.persona.name, sub: n.persona.role, color: n.persona.color, actLabel: '닫기 (E)', ai: true });
        chatBubble('msg-ai', n.persona.lines[0]);
        sfxTalk();
        if (!matchMedia('(pointer: coarse)').matches) vpInput.focus();
    }
    /* ---- 제보 드론 — 입력을 Trello 인박스로 보낸다 (LLM 호출 없음) ---- */
    const DRONE_OK = [
        '접수 완료! 보드에 꽂았어. 더 있으면 계속 적어줘.',
        '두 번째 제보 접수. 이런 게 제일 도움 돼.',
        '세 번째까지 받았어. 오늘은 여기까지야 — 고마워!'
    ];
    const DRONE_ERR = {
        rate_limited:   '오늘 할당량 끝났어. 다음에 또 와줘!',
        too_short:      '너무 짧아서 못 보내겠어. 한 문장만 더 적어줄래?',
        not_configured: '온라인 접수 준비 중이야. 연락 메뉴의 이메일로 보내줘. 아직 전송되지는 않았어.',
        busy: '앞선 제보를 보내는 중이야. 잠시만 기다려줘.',
        timeout: '응답이 늦어 접수 여부를 확인하지 못했어. 잠시 후 다시 확인해줘.',
        network:        '통신이 끊겼어. 잠시 후 다시 보내줄래?',
        server:         '전송에 실패했어. 잠시 후 다시 시도해줘.'
    };

    function openFeedbackChat(n) {
        stopMovement();
        talkingNPC = n;
        n.canceled = false;
        n.reports = n.reports || 0;
        if (!content.feedback.enabled) {
            showPanel({ kor: n.persona.name, sub: n.persona.role, color: n.persona.color, actLabel: '연락 페이지로 (E)', ai: true });
            vpForm.hidden = true;
            chatBubble('msg-ai', '온라인 제보 접수 준비 중이야. 연락 페이지의 이메일로 게임 의견을 보내줘.');
            return;
        }
        vpForm.hidden = false;
        showPanel({ kor: n.persona.name, sub: n.persona.role, color: n.persona.color, actLabel: '닫기 (E)', ai: true });
        chatBubble('msg-ai', n.persona.lines[0]);
        sfxTalk();
        if (!matchMedia('(pointer: coarse)').matches) vpInput.focus();
    }

    async function sendDroneReport(n, text) {
        n.busy = true;
        vpSend.disabled = true;
        const bubble = chatBubble('msg-ai', '전송 중…');
        try {
            const api = window.GGHF_FEEDBACK;
            // 사이드바 폼과 동일한 전송 경로(엔드포인트·레이트리밋·에러 해석 공유)
            const r = api
                ? await api.send({ summary: text, stage: 'village:제보드론' })
                : { ok: false, reason: 'network' };

            if (talkingNPC !== n || n.canceled) return;   // 도중에 대화 종료됨

            if (r.ok) {
                bubble.textContent = DRONE_OK[Math.min(n.reports, DRONE_OK.length - 1)];
                n.reports += 1;
            } else {
                bubble.textContent = DRONE_ERR[r.reason] || DRONE_ERR.server;
                if (!vpInput.value) vpInput.value = text;
            }
        } catch (err) {
            if (talkingNPC === n && !n.canceled) bubble.textContent = DRONE_ERR.network;
        } finally {
            n.busy = false;
            vpSend.disabled = false;
            vpChat.scrollTop = vpChat.scrollHeight;
        }
    }

    function fallbackReply(n, bubble) {
        const lines = n.persona.lines || [];
        const line = lines.length ? lines[n.fallbackIdx++ % lines.length] : '지금은 응답할 수 없어. 잠시 후 다시 말 걸어줘.';
        if (bubble) bubble.textContent = line;
        else chatBubble('msg-ai', line);
        vpChat.scrollTop = vpChat.scrollHeight;
    }
    function trimHistory(n) {
        // system + 최근 16개(≈8턴)만 유지 — 토큰·과금 상한
        if (n.messages.length > 17) n.messages = [n.messages[0], ...n.messages.slice(-16)];
    }
    vpForm.addEventListener('submit', async e => {
        e.preventDefault();
        const n = talkingNPC;
        if (!n || n.busy) return;
        if (!n.persona.isAI && !n.persona.isFeedback) return;
        const q = vpInput.value.trim();
        if (!q) return;
        chatBubble('msg-user', q);
        vpInput.value = '';
        if (n.persona.isFeedback) { await sendDroneReport(n, q); return; }
        n.messages.push({ role: 'user', content: q });
        n.busy = true;
        vpSend.disabled = true;
        const bubble = chatBubble('msg-ai', '…');
        try {
            await window.GGHF_HUB.loadAi();
            if (talkingNPC !== n || n.canceled) return;
            const resp = await puter.ai.chat(n.messages, { model: n.persona.model || AI_DEFAULT_MODEL, stream: true, max_tokens: 200 });
            let acc = '';
            for await (const part of resp) {
                if (talkingNPC !== n || n.canceled) return;
                const t = part?.text;
                if (t) { acc += t; bubble.textContent = acc; vpChat.scrollTop = vpChat.scrollHeight; }
            }
            if (acc) { n.messages.push({ role: 'assistant', content: acc }); trimHistory(n); }
            else fallbackReply(n, bubble);
        } catch (err) {
            fallbackReply(n, bubble);
        } finally {
            n.busy = false;
            vpSend.disabled = false;
        }
    });
    function updatePanel() {
        // 대화 중: 패널 유지, 너무 멀어지면 종료
        if (talkingNPC) {
            const dl = wrapLon(heroLon - talkingNPC.lon) * Math.max(0.3, Math.cos(heroLat));
            if (Math.hypot(dl, heroLat - talkingNPC.lat) * R > TALK_R + 1.0) endTalk();
            return;
        }
        // 대화 사거리 내 최근접 NPC — 스팟보다 우선
        let bestN = null, bnd = TALK_R;
        for (const n of NPCS) {
            const dl = wrapLon(heroLon - n.lon) * Math.max(0.3, Math.cos(heroLat));
            const surf = Math.hypot(dl, heroLat - n.lat) * R;
            if (surf < bnd) { bnd = surf; bestN = n; }
        }
        if (bestN) {
            if (bestN !== nearNPC) {
                nearNPC = bestN; nearSpot = null;
                const p = bestN.persona;
                showPanel({ kor: p.name, sub: p.role, desc: '말을 걸어보세요', color: p.color, actLabel: '대화 (E)' });
            }
            return;
        }
        if (nearNPC) { nearNPC = null; hidePanel(); }
        // 스팟 감지 (기존 동작 유지)
        let best = null, bd = 4.8;
        planetPos(heroLon, heroLat, _hpN).normalize();
        for (const s of SPOT_DEFS) {
            _spN.copy(s.pos).normalize();
            const surf = Math.acos(Math.max(-1, Math.min(1, _hpN.dot(_spN)))) * R;
            if (surf < bd) { bd = surf; best = s; }
        }
        if (best !== nearSpot) {
            nearSpot = best;
            if (best) showPanel({ kor: best.kor, sub: best.sub, desc: best.desc, badge: best.badge, color: best.color, actLabel: best.actLabel });
            else hidePanel();
        }
    }

    const CAM_DIST = 6.3, CAM_LIFT = 2.25, CAM_LAG = 5.2;
    const _camT = new THREE.Vector3(), _lookT = new THREE.Vector3();
    const _camS = new THREE.Vector3(), _lookS = new THREE.Vector3();
    const _sUp = new THREE.Vector3(), _sEast = new THREE.Vector3(), _sNorth = new THREE.Vector3();
    const _vDir = new THREE.Vector3(), _cRight = new THREE.Vector3(), _cUp = new THREE.Vector3();
    const _qm = new THREE.Matrix4();
    let camReady = false;

    function orientCamera(pos, target, surfUp, rollEast) {
        _vDir.copy(target).sub(pos);
        if (_vDir.lengthSq() < 1e-8) return;
        _vDir.normalize();
        if (Math.abs(surfUp.dot(_vDir)) > 0.85) _cUp.copy(rollEast);
        else {
            _cUp.copy(surfUp).addScaledVector(_vDir, -surfUp.dot(_vDir));
            if (_cUp.lengthSq() < 1e-8) _cUp.copy(rollEast);
            else _cUp.normalize();
        }
        _cRight.crossVectors(_vDir, _cUp);
        if (_cRight.lengthSq() < 1e-8) return;
        _cRight.normalize();
        _cUp.crossVectors(_cRight, _vDir).normalize();
        _qm.makeBasis(_cRight, _cUp, _vDir.clone().negate());
        camera.quaternion.setFromRotationMatrix(_qm);
    }

    function updateCamera(dt) {
        const k = dt == null ? 1 : 1 - Math.exp(-CAM_LAG * dt);
        hero.updateMatrixWorld();
        _sUp.setFromMatrixColumn(hero.matrixWorld, 1).normalize();
        _sEast.setFromMatrixColumn(hero.matrixWorld, 0).normalize();
        _camT.set(0, CAM_LIFT, CAM_DIST).applyQuaternion(hero.quaternion).add(hero.position);
        _lookT.set(0, 1.1, -1.9).applyQuaternion(hero.quaternion).add(hero.position);
        if (!camReady) { _camS.copy(_camT); _lookS.copy(_lookT); camReady = true; }
        _camS.lerp(_camT, k);
        _lookS.lerp(_lookT, k);
        camera.position.copy(_camS);
        if (launchAnim && launchAnim.t < 1.3) {
            const sh = 0.07 * (1 - launchAnim.t / 1.5);
            camera.position.x += (Math.random() - 0.5) * sh;
            camera.position.y += (Math.random() - 0.5) * sh;
        }
        orientCamera(_camS, _lookS, _sUp, _sEast);
    }

    function resolveCollisions() {
        for (const c of colliders) {
            const cosMid = Math.max(0.3, Math.cos((heroLat + c.lat) / 2));
            const dLon = wrapLon(heroLon - c.lon) * cosMid;
            const dLat = heroLat - c.lat;
            const dist = Math.hypot(dLon, dLat) * R;
            if (dist < c.keep && dist > 1e-5) {
                const push = (c.keep - dist) / R;
                const inv = 1 / Math.hypot(dLon, dLat);
                heroLon += (dLon * inv * push) / cosMid;
                heroLat += dLat * inv * push;
            }
        }
    }

    const clock = new THREE.Clock();
    const MOVE_SPEED = 4.6;
    const _mv = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
    const _heroFace = new THREE.Vector3(1, 0, 0);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function tick() {
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = performance.now() / 1000;

        // 로켓 발사 시퀀스 (이륙 → 페이드 → 세계 전환 → 착륙)
        if (launchAnim && rocketParts) {
            const T = (launchAnim.t += dt);
            const r = rocketParts;
            const lift = T < 1 ? T * T * 9 : Math.max(0, 2 - T) ** 2 * 9;
            r.ship.position.y = r.baseY + lift;
            r.flame.visible = lift > 0.03 && T < 1.95;
            if (r.flame.visible) r.flame.scale.set(1, 0.75 + Math.random() * 0.5, 1);
            hero.visible = !(T > 0.05 && T < 1.95);
            if (T < 1 && Math.random() < 0.55) spawnPuffAt(r.padPos, 0.42);
            fadeEl.style.opacity = T < 1
                ? Math.min(1, Math.max(0, (T - 0.5) / 0.4))
                : Math.min(1, Math.max(0, (1.55 - T) / 0.55));
            if (T >= 1 && !launchAnim.swapped) {
                launchAnim.swapped = true;
                applyTheme(!isSpace);
            }
            if (T >= 2.1) {
                launchAnim = null;
                r.ship.position.y = r.baseY;
                r.flame.visible = false;
                fadeEl.style.opacity = 0;
                hero.visible = true;
            }
        }

        const inX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + jv.x;
        const inY = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) - jv.z;
        let mag = Math.hypot(inX, inY);
        if (mag > 1) mag = 1;
        if (launchAnim) mag = 0;

        planetBasis(heroLon, heroLat, _sUp, _sEast, _sNorth);

        if (mag > 0.06) {
            _fw.set(0, 0, -1).applyQuaternion(camera.quaternion);
            _fw.addScaledVector(_sUp, -_fw.dot(_sUp));
            if (_fw.lengthSq() < 1e-6) _fw.copy(_sNorth);
            else _fw.normalize();
            _rt.set(1, 0, 0).applyQuaternion(camera.quaternion);
            _rt.addScaledVector(_sUp, -_rt.dot(_sUp));
            if (_rt.lengthSq() < 1e-6) _rt.crossVectors(_fw, _sUp).negate();
            else _rt.normalize();

            _mv.set(0, 0, 0).addScaledVector(_fw, inY).addScaledVector(_rt, inX);
            if (_mv.lengthSq() > 1e-6) {
                _mv.normalize();
                const step = MOVE_SPEED * dt * mag;
                const eastAmt = _mv.dot(_sEast), northAmt = _mv.dot(_sNorth);
                heroLon += (eastAmt * step) / (R * Math.max(0.3, Math.cos(heroLat)));
                heroLat += (northAmt * step) / R;
                const targetHeading = Math.atan2(eastAmt, northAmt);
                heading += wrapLon(targetHeading - heading) * (1 - Math.exp(-11 * dt));
                heading = wrapLon(heading);
            }
            walkBlend += (1 - walkBlend) * (1 - Math.exp(-9 * dt));
        } else {
            walkBlend += (0 - walkBlend) * (1 - Math.exp(-9 * dt));
        }

        resolveCollisions();
        heroLon = wrapLon(heroLon);
        heroLat = Math.max(-LAT_MAX, Math.min(LAT_MAX, heroLat));

        const lift = Math.abs(heroLat) < 0.06 ? bridgeLift(heroLon) : 0;
        planetBasis(heroLon, heroLat, _sUp, _sEast, _sNorth);
        _heroFace.copy(_sNorth).multiplyScalar(Math.cos(heading)).addScaledVector(_sEast, Math.sin(heading));
        orientOnPlanet(hero, heroLon, heroLat, _heroFace, lift);

        walkPhase += dt * 10.5 * walkBlend;
        const s = Math.sin(walkPhase);
        legL.rotation.x = s * 0.78 * walkBlend;
        legR.rotation.x = -s * 0.78 * walkBlend;
        armL.rotation.x = -s * 0.5 * walkBlend;
        armR.rotation.x = s * 0.5 * walkBlend;
        bodyGrp.position.y = (1 - Math.cos(walkPhase * 2)) * 0.033 * walkBlend + (reducedMotion ? 0 : Math.sin(t * 2.1) * 0.012);
        bodyGrp.rotation.x = -0.1 * walkBlend;
        bodyGrp.rotation.z = Math.sin(walkPhase) * 0.045 * walkBlend;

        if (walkBlend > 0.5 && !reducedMotion) {
            const stepSign = s > 0 ? 1 : -1;
            if (stepSign !== prevStep) { spawnPuff(); sfxStep(); prevStep = stepSign; }
        }
        for (const p of puffs) {
            if (p.life > 0) {
                p.life -= dt;
                const k = Math.max(0, p.life / 0.45);
                const s0 = p.s0 || 0.14;
                p.m.scale.setScalar(s0 + (1 - k) * s0 * 2.4);
                p.m.material.opacity = k * 0.5;
                if (p.life <= 0) p.m.visible = false;
            }
        }

        if (!reducedMotion) {
            swaySigns.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.1 + i * 1.7) * 0.022; });
        }
        cloudPivots.forEach(c => c.pivot.rotateY(c.speed * dt));
        shimmer.rotation.y += dt * 0.005;

        updateNPCs(dt, t);
        updateAnimals(dt, t);
        updateCamera(dt);
        updatePanel();
        renderer.render(scene, camera);
    }

    function getIslandState() {
        let npcMinDist = Infinity;
        for (const n of NPCS) {
            const cosMid = Math.max(0.3, Math.cos((heroLat + n.lat) / 2));
            const dl = wrapLon(heroLon - n.lon) * cosMid, da = heroLat - n.lat;
            npcMinDist = Math.min(npcMinDist, Math.hypot(dl, da) * R);
        }
        return {
            coordinateSystem: 'Longitude/latitude in radians on a sphere; arrow keys move relative to the camera.',
            mode: document.body.classList.contains('in-village') ? 'village' : 'page',
            space: isSpace,
            clockHour: new Date().getHours(), autoNight: realNight,
            launching: !!launchAnim,
            lon: +heroLon.toFixed(3), lat: +heroLat.toFixed(3), heading: +heading.toFixed(3),
            nearSpot: nearSpot ? nearSpot.id : null,
            nearNPC: nearNPC ? nearNPC.persona.name : null,
            talking: talkingNPC ? talkingNPC.persona.name : null,
            talkLine: talkLine,
            panelShown: panel.classList.contains('show'),
            panelDesc: document.getElementById('vp-desc').textContent,
            panelAct: document.getElementById('v-act').textContent,
            npcs: NPCS.length,
            npcMinDist: NPCS.length ? +npcMinDist.toFixed(3) : null,
            animals: birds.length + critters.length + flutters.length,
            audioOn: audioOn, audioReady: audioReady, audioState: audioCtx ? audioCtx.state : 'not-started',
            masterGain: sndMaster ? +sndMaster.gain.value.toFixed(3) : null,
            constellations: CONSTELLATIONS.length, deepsky: DEEPSKY.length, constVisible: constGroup.visible,
            calls: renderer.info.render.calls, tris: renderer.info.render.triangles
        };
    };

    addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop();
        else if (document.body.classList.contains('in-village')) {
            updateCamera(null);
            startLoop();
        }
        updateAudioActive();
    });

    window.GGHF_ISLAND = { enter: enterVillage, leave: leaveVillage, getState: getIslandState };
    document.body.classList.add('village-ready');
    pauseInlineGame();
    enterVillage();
    syncTimeTheme();   // 로드 시 현재 시각(낮/밤)에 맞춰 즉시 적용
} catch (err) {
    document.body.classList.remove('in-village');
    console.warn('GGHF island: 3D unavailable, falling back to homepage.', err);
    throw err;
}
