'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Landing3DCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Dimensions
    let width = container.clientWidth;
    let height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 4.2;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create a Globe Group to rotate everything together
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Texture Loader with CORS enabled
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    // Load high-resolution realistic Earth maps from reliable JSDelivr CDN (Three.js official planet assets)
    const earthMap = textureLoader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg'
    );
    const cloudsMap = textureLoader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png'
    );
    const specularMap = textureLoader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg'
    );

    // 1. Realistic Earth Base Sphere (Phong material for specular reflections)
    const globeGeometry = new THREE.SphereGeometry(1.6, 40, 40);
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: earthMap,
      specularMap: specularMap,
      specular: new THREE.Color('grey'),
      shininess: 25,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeGroup.add(globeMesh);

    // 2. Realistic Floating Clouds Layer (slightly larger, translucent, blends additively)
    const cloudsGeometry = new THREE.SphereGeometry(1.62, 40, 40);
    const cloudsMaterial = new THREE.MeshPhongMaterial({
      map: cloudsMap,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    globeGroup.add(cloudsMesh);

    // 3. Lighting Rig (Crucial for realistic specular highlights and shadow depths)
    // Ambient light (fills in the shadow sides slightly)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Directional light (acts as the Sun, projecting shadows and glares)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Subtle Particle Background for deep-space atmosphere
    const particlesCount = 100;
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 8;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x111111,
      transparent: true,
      opacity: 0.2,
    });
    const particlePoints = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlePoints);

    // Interaction Variables
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let scrollY = 0;
    let autoRotationSpeedY = 0.0035;

    // Drag / Swipe Handlers
    const handleDragStart = (clientX: number, clientY: number) => {
      isDragging = true;
      previousMousePosition = { x: clientX, y: clientY };
    };

    const handleDragMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const deltaX = clientX - previousMousePosition.x;
      const deltaY = clientY - previousMousePosition.y;

      globeGroup.rotation.y += deltaX * 0.006;
      globeGroup.rotation.x += deltaY * 0.006;

      previousMousePosition = { x: clientX, y: clientY };
    };

    const handleDragEnd = () => {
      isDragging = false;
    };

    // Mouse Event Listeners
    const onMouseDown = (e: MouseEvent) => {
      handleDragStart(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      handleDragEnd();
    };

    // Touch Event Listeners (mobile)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      handleDragEnd();
    };

    // Bind listeners
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    // Scroll zoom handler
    const handleScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      width = containerRef.current.clientWidth;
      height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const scrollFactor = scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
      
      // Auto-rotate Earth & Clouds separately when not dragging to create parallax depth
      if (!isDragging) {
        globeMesh.rotation.y += autoRotationSpeedY + scrollFactor * 0.012;
        // Clouds move at a slightly different speed
        cloudsMesh.rotation.y += autoRotationSpeedY * 1.35 + scrollFactor * 0.015;
        
        // Return slowly to stable tilt
        globeGroup.rotation.x += (0.12 - globeGroup.rotation.x) * 0.02;
      } else {
        // Dragging revolves both earth and clouds together. Clouds still drift slightly.
        cloudsMesh.rotation.y += 0.001;
      }

      // Parallax scroll translation
      globeGroup.position.y = -scrollFactor * 1.1;

      // Slowly rotate particle field
      particlePoints.rotation.y += 0.0006;

      renderer.render(scene, camera);
    };

    animate();

    // Clean up resources
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      globeGeometry.dispose();
      globeMaterial.dispose();
      cloudsGeometry.dispose();
      cloudsMaterial.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      earthMap.dispose();
      cloudsMap.dispose();
      specularMap.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] md:min-h-[500px] relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing" />
    </div>
  );
};
