import path from 'path';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import clear from 'rollup-plugin-clear';
import { eslint } from 'rollup-plugin-eslint';
import cleanup from 'rollup-plugin-cleanup';
import pkg from '../package.json';
import typescript from '@rollup/plugin-typescript';

const banner = `/*
* SoundTouch Audio Worklet v${pkg.version} AudioWorklet using the
* SoundTouch audio processing library
* 
* Copyright (c) Olli Parviainen
* Copyright (c) Ryan Berdeen
* Copyright (c) Jakub Fiala
* Copyright (c) Steve 'Cutter' Blades
* Copyright (c) Dance Cuts LLC
*
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU Lesser General Public
* License as published by the Free Software Foundation; either
* version 2.1 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public
* License along with this library; if not, write to the Free Software
* Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/\n`;

export default [
    {
        input: path.join(__dirname, '../src/createScheduledSoundTouchNode.ts'),
        output: [
            {
                file: 'dist/scheduled-soundtouch-audio-node.js',
                format: 'cjs',
                banner: banner,
                sourcemap: false,
                exports: 'named',
            },
        ],
        plugins: [
            clear({
                targets: [path.join(__dirname, '../dist')],
                watch: true,
            }),
            eslint(),
            typescript(),
            babel({
                babelHelpers: 'bundled',
                configFile: path.resolve(__dirname, '../configs/babel.config.json'),
            }),
            cleanup(),
        ],
    },
    {
        input: path.join(__dirname, '../src/ScheduledSoundTouchWorklet.ts'),
        output: [
            {
                file: 'dist/scheduled-soundtouch-worklet.js',
                format: 'cjs',
                banner: banner,
                sourcemap: false,
                exports: 'named',
            },
        ],
        plugins: [
            resolve({
                browser: true,
            }),
            eslint(),
            typescript(),
            babel({
                babelHelpers: 'bundled',
                configFile: path.resolve(__dirname, '../configs/babel.config.json'),
            }),
            cleanup(),
        ],
    },
    {
        input: path.join(__dirname, '../src/createScheduledSoundTouchNode.ts'),
        output: [
            {
                file: 'dist/scheduled-soundtouch-audio-node-esm.js',
                format: 'esm',
                banner: banner,
                sourcemap: false,
                exports: 'named',
            },
        ],
        plugins: [
            resolve({
                browser: true,
            }),
            eslint(),
            typescript(),
            cleanup(),
        ],
    },
];
