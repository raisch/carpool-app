<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<header class="site-masthead">
	<div class="site-masthead-inner">
		<a class="site-brand" href={resolve('/')} aria-label="Ligerbots Carpool home">
			<img class="site-brand-wordmark" src="/images/masthead_text.svg" alt="LigerBots" />
			<img class="site-brand-head" src="/images/liger_head.svg" alt="" aria-hidden="true" />
		</a>

		<nav class="site-social-links" aria-label="Ligerbots external links">
			<a
				class="site-social-link site-social-first"
				href="https://www.firstinspires.org/robotics/frc"
				target="_blank"
				rel="noreferrer"
				aria-label="FIRST Robotics"
			>
				<img src="/images/first.svg" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link"
				href="https://www.youtube.com/c/ligerbots"
				target="_blank"
				rel="noreferrer"
				aria-label="Ligerbots on YouTube"
			>
				<img src="/images/youtube.png" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link"
				href="https://x.com/ligerbots"
				target="_blank"
				rel="noreferrer"
				aria-label="Ligerbots on X"
			>
				<img src="/images/twitter.png" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link"
				href="https://www.facebook.com/The-LigerBots-162121450506644/"
				target="_blank"
				rel="noreferrer"
				aria-label="Ligerbots on Facebook"
			>
				<img src="/images/facebook.png" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link"
				href="https://www.instagram.com/ligerbots_frc2877/"
				target="_blank"
				rel="noreferrer"
				aria-label="Ligerbots on Instagram"
			>
				<img src="/images/instagram.png" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link"
				href="https://www.flickr.com/photos/ligerbots/"
				target="_blank"
				rel="noreferrer"
				aria-label="Ligerbots on Flickr"
			>
				<img src="/images/flickr.png" alt="" aria-hidden="true" />
			</a>
			<a
				class="site-social-link site-social-donate"
				href="https://www.ligerbots.org/sponsor-us"
				target="_blank"
				rel="noreferrer"
				aria-label="Support Ligerbots"
			>
				<img src="/images/donate.png" alt="" aria-hidden="true" />
			</a>
		</nav>
	</div>
</header>
