import React from 'react';
import { motion } from 'framer-motion';
import nodefleetLogo from '../assets/images/nodefleet.png';
import xIcon from '../assets/images/x.svg';
import discordIcon from '../assets/images/discord.svg';
import githubIcon from '../assets/images/github.svg';

const Footer: React.FC = () => {
    const socialLinks = [
        { href: 'https://x.com/nodefleet', icon: xIcon, alt: 'X' },
        { href: 'https://discord.gg/nodefleet', icon: discordIcon, alt: 'Discord' },
        { href: 'https://github.com/nodefleet', icon: githubIcon, alt: 'GitHub' }
    ];

    return (
        <motion.footer
            className="relative backdrop-blur-md bg-gradient-to-r from-blue-900/70 via-indigo-900/70 to-purple-900/70 text-white py-6 mt-auto border-t border-indigo-500/20 shadow-lg z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            {/* Decorative top gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-purple-500/50"></div>

            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                            <img
                                src={nodefleetLogo}
                                alt="NodeFleet Logo"
                                className="h-8 w-auto relative z-10 transition-transform duration-300 group-hover:scale-105"
                            />
                        </div>
                        <span className="text-gray-300 text-sm">© 2025 NodeFleet. All rights reserved.</span>
                    </motion.div>

                    <motion.div
                        className="flex items-center space-x-6"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        {socialLinks.map((link) => (
                            <motion.a
                                key={link.alt}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <div className="relative bg-gray-800/50 p-2 rounded-full border border-indigo-500/30 transition-colors duration-300 group-hover:bg-gray-700/50">
                                    <img src={link.icon} alt={link.alt} className="h-4 w-4" />
                                </div>
                            </motion.a>
                        ))}
                    </motion.div>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer; 