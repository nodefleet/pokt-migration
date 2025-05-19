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
            className="bg-gradient-to-r from-gray-900 via-blue-900/10 to-gray-900 text-white py-8 mt-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <img
                            src={nodefleetLogo}
                            alt="NodeFleet Logo"
                            className="h-8 w-auto"
                        />
                        <span className="text-gray-400">© 2024 NodeFleet. All rights reserved.</span>
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
                                className="text-gray-400 hover:text-white transition-colors duration-200"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <img src={link.icon} alt={link.alt} className="h-6 w-6" />
                            </motion.a>
                        ))}
                    </motion.div>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer; 