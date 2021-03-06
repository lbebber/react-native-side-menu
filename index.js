//@noflow
const styles = require('./styles');
const ReactNative = require('react-native');
const React = require('react');
const PropTypes = require('prop-types')
const { Dimensions, Animated, Text, BackHandler, } = ReactNative;
const deviceScreen = Dimensions.get('window');
import {StatusBar} from 'react-native';
import Hamburger from '@lbebber/react-native-hamburger';

const {
  PanResponder,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
} = ReactNative;

/**
 * Size of the amount you can move content view in the opened menu state and
 * release without menu closing
 * @type {Number}
 */
const barrierForward = deviceScreen.width / 4;

/**
 * Check if the current gesture offset bigger than allowed one
 * before opening menu
 * @param  {Number} dx Gesture offset from the left side of the window
 * @return {Boolean}
 */
function shouldOpenMenu(dx: Number) {
  return dx > barrierForward;
}

class SideMenu extends React.Component {
  constructor(props) {
    super(props);

    /**
     * Default left offset for content view
     * @todo Check if it's possible to avoid using `prevLeft`
     * @type {Number}
     */
    this.prevLeft = 0;
    this.isOpen = !!props.isOpen;

    const initialMenuPositionMultiplier = props.menuPosition === 'right' ? -1 : 1
    const openOffsetMenuPercentage = props.openMenuOffset / deviceScreen.width;
    const hiddenMenuOffsetPercentage = props.hiddenMenuOffset / deviceScreen.width;

    this.state = {
      width: deviceScreen.width,
      height: deviceScreen.height,
      openOffsetMenuPercentage: openOffsetMenuPercentage,
      openMenuOffset: deviceScreen.width * openOffsetMenuPercentage,
      hiddenMenuOffsetPercentage: hiddenMenuOffsetPercentage,
      hiddenMenuOffset: deviceScreen.width * hiddenMenuOffsetPercentage,
      left: new Animated.Value(
        props.isOpen ? props.openMenuOffset * initialMenuPositionMultiplier : props.hiddenMenuOffset
      ),
    };

  }

  /**
   * Set the initial responders
   * @return {Void}
   */
  componentWillMount() {
    this.responder = PanResponder.create({
      onStartShouldSetResponderCapture: this.props.onStartShouldSetResponderCapture.bind(this),
      onMoveShouldSetPanResponder: this.handleMoveShouldSetPanResponder.bind(this),
      onPanResponderMove: this.handlePanResponderMove.bind(this),
      onPanResponderRelease: this.handlePanResponderEnd.bind(this),
    });
  }

  componentWillReceiveProps(props) {
    if (typeof props.isOpen !== 'undefined' && this.isOpen !== props.isOpen) {
      this.openMenu(props.isOpen);
    }
  }

  /**
   * Determines if gestures are enabled, based off of disableGestures prop
   * @return {Boolean}
   */
  gesturesAreEnabled() {
    let { disableGestures, } = this.props;

    if (typeof disableGestures === 'function') {
      return !disableGestures();
    }

    return !disableGestures;
  }

  /**
   * Permission to use responder
   * @return {Boolean}
   */
  handleMoveShouldSetPanResponder(e: Object, gestureState: Object) {
    if (this.gesturesAreEnabled()) {
      const x = Math.round(Math.abs(gestureState.dx));
      const y = Math.round(Math.abs(gestureState.dy));

      const touchMoved = x > this.props.toleranceX && y < this.props.toleranceY;

      if (this.isOpen) {
        return touchMoved;
      }

      const withinEdgeHitWidth = this.props.menuPosition === 'right' ?
        gestureState.moveX > (deviceScreen.width - this.props.edgeHitWidth) :
        gestureState.moveX < this.props.edgeHitWidth;

      const swipingToOpen = this.menuPositionMultiplier() * gestureState.dx > 0;
      return withinEdgeHitWidth && touchMoved && swipingToOpen;
    }

    return false;
  }

  /**
   * Handler on responder move
   * @param  {Synthetic Event} e
   * @param  {Object} gestureState
   * @return {Void}
   */
  handlePanResponderMove(e: Object, gestureState: Object) {
    if (this.state.left.__getValue() * this.menuPositionMultiplier() >= 0) {
      let newLeft = this.prevLeft + gestureState.dx;

      if (!this.props.bounceBackOnOverdraw && Math.abs(newLeft) > this.state.openMenuOffset) {
        newLeft = this.menuPositionMultiplier() * this.state.openMenuOffset;
      }

      this.props.onMove(newLeft);
      this.state.left.setValue(newLeft);
    }
  }

  /**
   * Handler on responder move ending
   * @param  {Synthetic Event} e
   * @param  {Object} gestureState
   * @return {Void}
   */
  handlePanResponderEnd(e: Object, gestureState: Object) {
    const offsetLeft = this.menuPositionMultiplier() *
      (this.state.left.__getValue() + gestureState.dx);

    this.openMenu(shouldOpenMenu(offsetLeft));
  }

  /**
   * Returns 1 or -1 depending on the menuPosition
   * @return {Number}
   */
  menuPositionMultiplier() {
    return this.props.menuPosition === 'right' ? -1 : 1;
  }

  moveLeft(offset) {
    const newOffset = this.menuPositionMultiplier() * offset;

    this.props
      .animationFunction(this.state.left, newOffset)
      .start();

    this.prevLeft = newOffset;
  }

  /**
   * Toggle menu
   * @return {Void}
   */
  openMenu(isOpen) {
    const { hiddenMenuOffset, openMenuOffset, } = this.state;
    this.moveLeft(isOpen ? openMenuOffset : hiddenMenuOffset);
    this.isOpen = isOpen;

    this.forceUpdate();
    this.props.onChange(isOpen);

    BackHandler.addEventListener('hardwareBackPress',event=>{
      if(this.isOpen){
        this.openMenu(false);
        return true;
      }
      return false;
    });
  }

  /**
   * Get content view. This view will be rendered over menu
   * @return {React.Component}
   */
  getContentView() {
    const overlay = (
      <TouchableWithoutFeedback 
        onPress={() => this.openMenu(false)}
      >
      <Animated.View 
        style={{...StyleSheet.flatten(styles.overlay),
          opacity:this.state.left.interpolate({
            inputRange:[0,this.props.openMenuOffset],
            outputRange:[0,1],
          }),
        }}
        pointerEvents={this.isOpen?'auto':'none'}
      />
      </TouchableWithoutFeedback>
    );

    const { width, height, } = this.state;
    const ref = (sideMenu) => this.sideMenu = sideMenu;
    const style = [
      styles.frontView,
      { width, height, },
      this.props.animationStyle(this.state.left),
    ];

    return (
      <Animated.View style={style} ref={ref} {...this.responder.panHandlers}>
        <Animated.View 
          style={{
            position:'absolute',
            left:0,
            top:0,
            bottom:0,
            right:0,
            transform:[
              {translateX:this.state.left.interpolate({
                inputRange:[0,this.props.openMenuOffset],
                outputRange:[0,-this.props.openMenuOffset/2],
              })},
            ]
          }}
        >
          {this.props.children}
        </Animated.View>
        {overlay}
      </Animated.View>
    );
  }

  onLayoutChange(e) {
    const { width, height, } = e.nativeEvent.layout;
    const openMenuOffset = width * this.state.openOffsetMenuPercentage;
    const hiddenMenuOffset = width * this.state.hiddenMenuOffsetPercentage;
    this.setState({ width, height, openMenuOffset, hiddenMenuOffset });
  }

  /**
   * Compose and render menu and content view
   * @return {React.Component}
   */
  render() {

    const boundryStyle = this.props.menuPosition == 'right' ?
      {left: this.state.width - this.state.openMenuOffset} :
      {right: this.state.width - this.state.openMenuOffset} ;

    const menu = <Animated.View style={[styles.menu, boundryStyle,{
      transform:[
        {translateX:this.state.left.interpolate({
          inputRange:[0,this.props.openMenuOffset],
          outputRange:[-this.props.openMenuOffset,0],
        })},
      ],
    }]}>
      <View style={{
        height:StatusBar.currentHeight,
        backgroundColor:this.props.background,
      }}>
      </View>
      <View
        style={{
          height:50,
          alignItems:'center',
          backgroundColor:this.props.background,
          flexDirection:'row',
        }}
      >
        <Hamburger 
          color={this.props.color}
          type="cross" 
          onPress={()=>this.openMenu(false)}
        />
        {this.props.title!=null &&
          <Text
            style={{
              color:this.props.color,
              fontSize:18,
              fontWeight:'bold',
            }}
          >
            {this.props.title}
          </Text>
        }
      </View>
      {this.props.menu}
    </Animated.View>;

    return (
      <View style={styles.container} onLayout={this.onLayoutChange.bind(this)} {...this.responder.panHandlers}>
        {menu}
        {this.getContentView()}
      </View>
    );
  }
}

SideMenu.propTypes = {
  edgeHitWidth: PropTypes.number,
  toleranceX: PropTypes.number,
  toleranceY: PropTypes.number,
  menuPosition: PropTypes.oneOf(['left', 'right', ]),
  onChange: PropTypes.func,
  onMove: PropTypes.func,
  openMenuOffset: PropTypes.number,
  hiddenMenuOffset: PropTypes.number,
  disableGestures: PropTypes.oneOfType([PropTypes.func, PropTypes.bool, ]),
  animationFunction: PropTypes.func,
  onStartShouldSetResponderCapture: PropTypes.func,
  isOpen: PropTypes.bool,
  bounceBackOnOverdraw: PropTypes.bool,
};

SideMenu.defaultProps = {
  background:'transparent',
  color:'black',
  title:null,
  toleranceY: 10,
  toleranceX: 10,
  edgeHitWidth: 60,
  openMenuOffset: deviceScreen.width * 2 / 3,
  hiddenMenuOffset: 0,
  onMove: () => {},
  onStartShouldSetResponderCapture: () => true,
  onChange: () => {},
  animationStyle: (value) => {
    return {
      transform: [{
        translateX: value,
      }, ],
    };
  },
  animationFunction: (prop, value) => {
    return Animated.timing(
      prop,
      {
        toValue:value,
        duration:300,
      }
    )
  },
  bounceBackOnOverdraw: true,
};

module.exports = SideMenu;
