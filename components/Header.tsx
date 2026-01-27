import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import Navitems from './Navitems'
import UserDropdown from './UserDropdown'

const Header = ({user}:{user:User}) => {
  return (
    <header className="sticky top-0 header">
      <div className="container header-wrapper">
        <Link href="/">
          <Image
            src="/assets/icons/logo.svg"
            alt="StockSense Logo"
            width={140}
            height={32}
          />
        </Link>

        <nav className="hidden sm:block">
          <Navitems />
        </nav>
        <UserDropdown user={user} />
      </div>
    </header>
  )
}

export default Header
