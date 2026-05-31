import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

/**
 * ThreeJSScene - Cinematic 3D background with atmospheric effects
 * Creates a production-quality game window with depth and immersion
 */
export default function ThreeJSScene({ inCombat = false, season = 'Spring', timeOfDay = 'Morning' }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Size to the CONTAINER, not the window. Using window.innerHeight made the
    // canvas as tall as the whole viewport inside a smaller frame, which forced
    // the browser to scroll/jump whenever the scene re-mounted (e.g. combat start).
    const getSize = () => {
      const el = containerRef.current;
      return {
        w: el?.clientWidth || window.innerWidth,
        h: el?.clientHeight || window.innerHeight,
      };
    };
    const { w: initW, h: initH } = getSize();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      initW / initH,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Renderer with alpha for transparency
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Force the canvas to fill its container via CSS instead of fixed pixel
    // dimensions, so it can never exceed the frame and trigger a scroll.
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    containerRef.current.appendChild(renderer.domElement);

    // Create atmospheric particles
    const particleCount = 200;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Particle material - color based on season/time
    const getParticleColor = () => {
      if (inCombat) return new THREE.Color(0x8b1a1a); // Red in combat
      
      const seasonColors = {
        Spring: 0x90EE90, // Light green
        Summer: 0xFFD700, // Gold
        Autumn: 0xFF8C00, // Orange
        Winter: 0xE0FFFF, // Light cyan
      };
      
      const timeColors = {
        Dawn: 0xFFB6C1, // Pink
        Morning: 0x87CEEB, // Sky blue
        Midday: 0xFFFFFF, // White
        Afternoon: 0xFFE4B5, // Moccasin
        Dusk: 0xFF6347, // Tomato
        Evening: 0x4B0082, // Indigo
        Night: 0x191972, // Midnight blue
        Midnight: 0x000080, // Navy
      };

      return new THREE.Color(seasonColors[season] || seasonColors.Spring);
    };

    const particleMaterial = new THREE.PointsMaterial({
      color: getParticleColor(),
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // Add ambient light glow
    const ambientLight = new THREE.PointLight(0xc9a96e, 0.5, 10);
    ambientLight.position.set(0, 2, 3);
    scene.add(ambientLight);

    // Combat aura effect
    if (inCombat) {
      const auraGeometry = new THREE.SphereGeometry(3, 32, 32);
      const auraMaterial = new THREE.MeshBasicMaterial({
        color: 0xdc2626,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const aura = new THREE.Mesh(auraGeometry, auraMaterial);
      scene.add(aura);

      // Animate aura pulse
      let auraScale = 1;
      let auraGrowing = true;
      
      const animateAura = () => {
        if (auraGrowing) {
          auraScale += 0.005;
          if (auraScale > 1.3) auraGrowing = false;
        } else {
          auraScale -= 0.005;
          if (auraScale < 1) auraGrowing = true;
        }
        aura.scale.set(auraScale, auraScale, auraScale);
      };

      particleSystem.userData.animateAura = animateAura;
    }

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Update particles
      const positions = particles.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Boundary check
        if (Math.abs(positions[i * 3]) > 10) velocities[i * 3] *= -1;
        if (Math.abs(positions[i * 3 + 1]) > 10) velocities[i * 3 + 1] *= -1;
        if (Math.abs(positions[i * 3 + 2]) > 5) velocities[i * 3 + 2] *= -1;
      }
      particles.attributes.position.needsUpdate = true;

      // Rotate particle system slowly
      particleSystem.rotation.y += 0.0005;
      particleSystem.rotation.x += 0.0002;

      // Animate combat aura if present
      if (particleSystem.userData.animateAura) {
        particleSystem.userData.animateAura();
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize — measure the container, not the window, and keep the
    // canvas CSS-filling so it never overflows the frame.
    const handleResize = () => {
      const { w, h } = getSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      particles.dispose();
      particleMaterial.dispose();
    };
  }, [inCombat, season, timeOfDay]);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}